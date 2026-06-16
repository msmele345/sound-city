import { parseIcs } from "./ics-parser";
import type { CreateReviewItemInput, SourceTargetRecord } from "./types";

const parserVersion = "venue-calendar@1";

export type FetchResult = {
  body: string;
  contentType: string;
  status: number;
};

export type Fetcher = (url: string) => Promise<FetchResult>;

function normalizeForFingerprint(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isIcsContent(url: string, contentType: string): boolean {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.includes("text/calendar")) return true;

  try {
    return new URL(url).pathname.toLowerCase().endsWith(".ics");
  } catch {
    return url.split(/[?#]/, 1)[0].toLowerCase().endsWith(".ics");
  }
}

export async function parseVenueCalendarTarget(
  target: SourceTargetRecord,
  runId: string,
  fetchedAt: string,
  fetcher: Fetcher,
): Promise<CreateReviewItemInput[]> {
  const result = await fetcher(target.url);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `Venue calendar fetch failed with status ${result.status}`,
    );
  }

  if (!isIcsContent(target.url, result.contentType)) {
    throw new Error(
      "Venue calendar source does not serve a structured feed (ICS). " +
        "HTML-only calendars may require login, CAPTCHA, or JavaScript rendering and are skipped.",
    );
  }

  const icsEvents = parseIcs(result.body);

  return icsEvents.map((event) => {
    const title = event.summary;
    const venueName = event.location ?? "";
    const startsAt = event.dtStart;
    const confidence = Math.max(
      0,
      Math.min(100, 82 + target.confidenceAdjustment),
    );
    const matchFingerprint = `venue-cal:${normalizeForFingerprint(title)}:${normalizeForFingerprint(startsAt)}:${normalizeForFingerprint(venueName)}`;
    const eventUrl = event.url ?? target.url;

    return {
      cityId: target.cityId,
      runId,
      sourceTargetId: target.id,
      lane: "new-event" as const,
      priority: 75,
      confidence,
      confidenceReasons: [
        "official venue calendar",
        "structured ICS feed",
      ],
      targetEntityType: "event" as const,
      targetEntityId: null,
      matchFingerprint,
      normalizedDraft: {
        title,
        venueName,
        startsAt,
        styles: [],
        ticketUrl: eventUrl,
      },
      fieldDiffs: null,
      linkedDrafts: venueName
        ? [{ type: "venue", name: venueName }]
        : [],
      conflicts: null,
      evidence: {
        sourceUrls: [eventUrl],
        excerpts: [
          `${title}${venueName ? ` at ${venueName}` : ""} on ${startsAt}`,
        ],
        contentHashes: [`${event.uid}:${parserVersion}`],
      },
      parserVersion,
      fetchTimestamp: fetchedAt,
    };
  });
}
