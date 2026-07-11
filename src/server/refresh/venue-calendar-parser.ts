import { normalizeStyleTags } from "@/lib/style-normalization";

import {
  buildMatchFingerprint,
  buildMaterialContentHash,
} from "./candidate-identity";
import { parseIcs } from "./ics-parser";
import type { Fetcher, ParserCandidate, SourceTargetRecord } from "./types";

const parserVersion = "venue-calendar@1";

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
): Promise<ParserCandidate[]> {
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
    const eventUrl = event.url ?? target.url;
    const normalizedDraft = {
      title,
      venueName,
      startsAt,
      styles: normalizeStyleTags(event.categories),
      ticketUrl: eventUrl,
    };

    return {
      sourceEventKey: event.uid,
      matchFingerprint: buildMatchFingerprint(normalizedDraft),
      materialContentHash: buildMaterialContentHash(normalizedDraft),
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
      normalizedDraft,
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
