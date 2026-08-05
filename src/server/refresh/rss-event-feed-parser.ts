import { normalizeStyleTags } from "@/lib/style-normalization";
import { XMLParser, XMLValidator } from "fast-xml-parser";

import {
  buildMatchFingerprint,
  buildMaterialContentHash,
  canonicalizeSourceUrl,
} from "./candidate-identity";
import type {
  Fetcher,
  ParserCandidate,
  SourceOwnerRecord,
  SourceTargetRecord,
} from "./types";

const parserVersion = "rss-event-feed@4";
const chicagoTimeZone = "America/Chicago";
const radiusDetailHostnames = [
  "radius-chicago.com",
  "www.radius-chicago.com",
] as const;
const rssXmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: false,
});

type RssItem = {
  guid: string;
  title: string;
  link: string;
  description: string;
  categories: string[];
};

type ParserContext = {
  owner?: SourceOwnerRecord | null;
};

type RssItemEnrichment = {
  startsAt?: string;
  doorsAt?: string;
  agePolicy?: string;
  ticketUrl?: string;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function cleanText(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function xmlText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return cleanText(String(value));
  }
  if (Array.isArray(value)) {
    return cleanText(value.map(xmlText).join(" "));
  }
  const record = xmlRecord(value);
  return record ? xmlText(record["#text"] ?? record["#cdata"] ?? "") : "";
}

function parseRssItems(xml: string): RssItem[] {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`Malformed RSS/XML document: ${validation.err.msg}`);
  }
  const document = xmlRecord(rssXmlParser.parse(xml));
  const rss = xmlRecord(document?.rss);
  const channel = xmlRecord(rss?.channel);
  const itemNodes = Array.isArray(channel?.item)
    ? channel.item
    : channel?.item
      ? [channel.item]
      : [];

  return itemNodes
    .map(xmlRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      guid: xmlText(item.guid),
      title: xmlText(item.title),
      link: xmlText(item.link),
      description: xmlText(item.description),
      categories: (Array.isArray(item.category)
        ? item.category
        : item.category
          ? [item.category]
          : []
      )
        .map(xmlText)
        .filter(Boolean),
    }))
    .filter((item) => item.title && item.link);
}

function isRssContent(url: string, contentType: string, body: string): boolean {
  const normalizedType = contentType.toLowerCase();
  if (
    normalizedType.includes("rss") ||
    normalizedType.includes("xml") ||
    normalizedType.includes("application/atom+xml")
  ) {
    return true;
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".xml") || pathname.endsWith("/feed/")) return true;
  } catch {
    if (url.toLowerCase().includes("/feed")) return true;
  }

  return /<(rss|feed)\b/i.test(body);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function localChicagoDateToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMs(utcGuess, chicagoTimeZone);
  return new Date(utcGuess.getTime() - offset).toISOString();
}

function monthNumber(monthName: string): number | null {
  const normalizedMonth = monthName.toLowerCase();
  const month = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].findIndex(
    (candidate) =>
      candidate === normalizedMonth ||
      candidate.slice(0, 3) === normalizedMonth.slice(0, 3),
  );
  return month >= 0 ? month + 1 : null;
}

function isRadiusTarget(target: SourceTargetRecord): boolean {
  try {
    return new URL(target.url).hostname.replace(/^www\./i, "").toLowerCase() ===
      "radius-chicago.com";
  } catch {
    return false;
  }
}

function extractRadiusTitleFields(
  target: SourceTargetRecord,
  title: string,
): { title: string; eventDate?: string } {
  if (!isRadiusTarget(target)) return { title };

  const match = title.match(
    /^(.*?)\s+on\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),\s+(\d{4})$/i,
  );
  if (!match) return { title };

  const month = monthNumber(match[2]);
  if (!month) return { title };

  const day = Number(match[3]);
  const year = Number(match[4]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { title };
  }

  return {
    title: match[1].trim(),
    eventDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function hourFromMeridiem(hour: number, meridiem: string): number {
  const normalized = hour % 12;
  return meridiem.toLowerCase() === "pm" ? normalized + 12 : normalized;
}

function extractLabeledDetailValue(html: string, label: string) {
  const match = html.match(
    new RegExp(
      `<label\\b[^>]*>\\s*${label}\\s*</label>\\s*<span\\b[^>]*>([\\s\\S]*?)</span>`,
      "i",
    ),
  );
  return match ? cleanText(match[1]) : undefined;
}

function extractHtmlAttribute(tag: string, attribute: string) {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  );
  return match ? decodeXmlEntities(match[2]).trim() : undefined;
}

function radiusTicketUrl(html: string, detailUrl: string) {
  const ticketAnchor = (html.match(/<a\b[^>]*>/gi) ?? []).find((anchor) => {
    const title = extractHtmlAttribute(anchor, "title");
    const classes = extractHtmlAttribute(anchor, "class")?.split(/\s+/) ?? [];
    return title?.toLowerCase() === "buy tickets" && classes.includes("tickets");
  });
  const href = ticketAnchor
    ? extractHtmlAttribute(ticketAnchor, "href")
    : undefined;
  if (!href) return undefined;

  try {
    const url = new URL(href, detailUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }
    return canonicalizeSourceUrl(url.toString());
  } catch {
    return undefined;
  }
}

function localChicagoEventTime(
  eventDate: string | undefined,
  value: string | undefined,
) {
  if (!eventDate || !value) return undefined;
  const dateMatch = eventDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!dateMatch || !timeMatch) return undefined;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return undefined;

  return localChicagoDateToIso(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    hourFromMeridiem(hour, timeMatch[3]),
    minute,
  );
}

function normalizeRadiusAgePolicy(value: string | undefined) {
  if (!value) return undefined;
  const minimumAge = value.match(/^(\d{1,2})\s*(?:&|and)\s*over$/i)?.[1];
  return minimumAge ? `${minimumAge}+` : value;
}

function extractRadiusDetailFields(
  html: string,
  eventDate: string | undefined,
  detailUrl: string,
): RssItemEnrichment {
  const eventTime = extractLabeledDetailValue(html, "Time");
  const doorsTime = extractLabeledDetailValue(html, "Doors");
  const agePolicy = normalizeRadiusAgePolicy(
    extractLabeledDetailValue(html, "Ages"),
  );
  const ticketUrl = radiusTicketUrl(html, detailUrl);
  const startsAt = localChicagoEventTime(eventDate, eventTime);
  const doorsAt = localChicagoEventTime(eventDate, doorsTime);

  return {
    ...(startsAt ? { startsAt } : {}),
    ...(doorsAt ? { doorsAt } : {}),
    ...(agePolicy ? { agePolicy } : {}),
    ...(ticketUrl ? { ticketUrl } : {}),
  };
}

function extractDescriptionStart(description: string): string | null {
  const normalized = cleanText(description);
  const dateMatch = normalized.match(
    /(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?,?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,
  );
  const timeMatch = normalized.match(
    /(?:doors?|starts?|show)\s*:?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  ) ?? normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (!dateMatch || !timeMatch) return null;

  const month = monthNumber(dateMatch[1]);
  if (!month) return null;

  const day = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = hourFromMeridiem(Number(timeMatch[1]), timeMatch[3]);
  const minute = Number(timeMatch[2] ?? 0);

  return localChicagoDateToIso(year, month, day, hour, minute);
}

function splitLineup(value: string): string[] {
  return value
    .split(/\s*\*\s*/)
    .map((artist) => artist.trim())
    .filter(Boolean);
}

function extractCompactDescriptionFields(description: string, title: string) {
  const normalized = cleanText(description);
  const priceStart = normalized.search(/\$\d/);
  const beforePrice =
    priceStart >= 0 ? normalized.slice(0, priceStart) : normalized;
  const featuringIndex = beforePrice.toLowerCase().lastIndexOf("featuring");
  const lineup =
    featuringIndex >= 0
      ? splitLineup(beforePrice.slice(featuringIndex + "featuring".length))
      : title.includes("*")
        ? splitLineup(title)
        : [];
  const price = normalized.match(
    /(\$\d[\s\S]*?)(?=\s*\/\s*(?:\d{1,2}\+|all ages)(?:\s*\/|$))/i,
  )?.[1].trim();
  const agePolicy = normalized.match(
    /(?:^|\s*\/\s*)(\d{1,2}\+|all ages)(?=\s*\/|$)/i,
  )?.[1];
  const startsAt = extractDescriptionStart(normalized);

  return {
    startsAt,
    ...(startsAt && /\bdoors?\s*:/i.test(normalized)
      ? { doorsAt: startsAt }
      : {}),
    ...(lineup.length > 0 ? { lineup } : {}),
    ...(price ? { price } : {}),
    ...(agePolicy ? { agePolicy } : {}),
  };
}

function reviewItemForItem(
  target: SourceTargetRecord,
  runId: string,
  fetchedAt: string,
  item: RssItem,
  context: ParserContext = {},
  enrichment: RssItemEnrichment = {},
): ParserCandidate {
  const titleFields = extractRadiusTitleFields(target, item.title);
  const compactFields = extractCompactDescriptionFields(
    item.description,
    titleFields.title,
  );
  const { startsAt: descriptionStartsAt, ...descriptionFields } = compactFields;
  const {
    startsAt: enrichedStartsAt,
    ticketUrl: enrichedTicketUrl,
    ...enrichedFields
  } = enrichment;
  const startsAt = enrichedStartsAt ?? descriptionStartsAt;
  const excerpt = cleanText(item.description);
  const venueName = context.owner?.kind === "venue" ? context.owner.name : "";
  const linkedDrafts = venueName ? [{ type: "venue", name: venueName }] : [];
  const canonicalUrl = canonicalizeSourceUrl(item.link);
  const sourceEventKey = item.guid || canonicalUrl;

  if (!startsAt) {
    const normalizedDraft = {
      issue: titleFields.eventDate
        ? "rss-item-missing-event-time"
        : "rss-item-missing-event-date",
      ...titleFields,
      sourceUrl: canonicalUrl,
    };
    return {
      sourceEventKey,
      materialContentHash: buildMaterialContentHash(normalizedDraft),
      cityId: target.cityId,
      runId,
      sourceTargetId: target.id,
      lane: "source-health",
      priority: 40,
      confidence: 20,
      confidenceReasons: [
        "RSS item did not include a reliable event date in the description",
      ],
      targetEntityType: "source-target",
      targetEntityId: target.id,
      matchFingerprint: `source-health:${target.id}:${sourceEventKey}`,
      normalizedDraft,
      fieldDiffs: null,
      linkedDrafts: [],
      conflicts: {
        reason:
          titleFields.eventDate
            ? "RSS item has an event date but no reliable event time; no startsAt was guessed."
            : "RSS item has no reliable event date in its description; pubDate was not used as startsAt.",
      },
      evidence: {
        sourceUrls: [canonicalUrl],
        excerpts: excerpt ? [excerpt] : [],
        contentHashes: [`${canonicalUrl}:missing-date:${parserVersion}`],
      },
      parserVersion,
      fetchTimestamp: fetchedAt,
    };
  }

  const confidence = clampConfidence(68 + target.confidenceAdjustment);
  const normalizedDraft = {
    ...titleFields,
    startsAt,
    ...descriptionFields,
    ...enrichedFields,
    ...(venueName ? { venueName } : {}),
    styles: normalizeStyleTags(item.categories),
    canonicalUrl,
    ticketUrl: enrichedTicketUrl ?? canonicalUrl,
  };

  return {
    sourceEventKey,
    materialContentHash: buildMaterialContentHash(normalizedDraft),
    cityId: target.cityId,
    runId,
    sourceTargetId: target.id,
    lane: "new-event",
    priority: 60,
    confidence,
    confidenceReasons: [
      "official venue RSS feed",
      "event date extracted from item description",
      "RSS description requires admin verification",
    ],
    targetEntityType: "event",
    targetEntityId: null,
    matchFingerprint: buildMatchFingerprint(normalizedDraft),
    normalizedDraft,
    fieldDiffs: null,
    linkedDrafts,
    conflicts: null,
    evidence: {
      sourceUrls: [canonicalUrl],
      excerpts: [excerpt],
      contentHashes: [`${canonicalUrl}:${parserVersion}`],
    },
    parserVersion,
    fetchTimestamp: fetchedAt,
  };
}

export async function parseRssEventFeedTarget(
  target: SourceTargetRecord,
  runId: string,
  fetchedAt: string,
  fetcher: Fetcher,
  context: ParserContext = {},
): Promise<ParserCandidate[]> {
  const result = await fetcher(target.url);

  if (result.status === 304) {
    return [];
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`RSS event feed fetch failed with status ${result.status}`);
  }

  if (!isRssContent(target.url, result.contentType, result.body)) {
    throw new Error("RSS event feed source does not serve structured RSS/XML.");
  }

  const items = parseRssItems(result.body);
  if (items.length === 0) {
    throw new Error("RSS event feed source does not contain RSS/XML event items.");
  }

  const enrichments = isRadiusTarget(target)
    ? await Promise.all(
        items.map(async (item) => {
          const detail = await fetcher(item.link, undefined, {
            allowedHostnames: radiusDetailHostnames,
          });
          const titleFields = extractRadiusTitleFields(target, item.title);
          return extractRadiusDetailFields(
            detail.body,
            titleFields.eventDate,
            item.link,
          );
        }),
      )
    : items.map(() => ({}));

  return items.map((item, index) =>
    reviewItemForItem(
      target,
      runId,
      fetchedAt,
      item,
      context,
      enrichments[index],
    ),
  );
}
