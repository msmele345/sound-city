import { normalizeStyleTags } from "@/lib/style-normalization";

import type {
  CreateReviewItemInput,
  Fetcher,
  SourceOwnerRecord,
  SourceTargetRecord,
} from "./types";

const parserVersion = "rss-event-feed@1";
const chicagoTimeZone = "America/Chicago";

type RssItem = {
  title: string;
  link: string;
  description: string;
  categories: string[];
};

type ParserContext = {
  owner?: SourceOwnerRecord | null;
};

function normalizeForFingerprint(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
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

function tagValue(xml: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"),
  );
  return match ? cleanText(match[1]) : "";
}

function tagValues(xml: string, tag: string): string[] {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    ...xml.matchAll(
      new RegExp(
        `<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`,
        "gi",
      ),
    ),
  ]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

function parseRssItems(xml: string): RssItem[] {
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);

  return [...itemMatches]
    .map((match) => ({
      title: tagValue(match[1], "title"),
      link: tagValue(match[1], "link"),
      description: tagValue(match[1], "description"),
      categories: tagValues(match[1], "category"),
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

function isHtmlContent(contentType: string, body: string): boolean {
  return (
    contentType.toLowerCase().includes("html") ||
    /<html\b|<!doctype html/i.test(body)
  );
}

function attrValue(attributes: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(
    new RegExp(
      `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return decodeXmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function sameOriginUrl(pageUrl: string, candidateUrl: string): string | null {
  try {
    const page = new URL(pageUrl);
    const candidate = new URL(candidateUrl, page);
    return candidate.origin === page.origin ? candidate.toString() : null;
  } catch {
    return null;
  }
}

function looksLikeRssLink(attributes: string, label = ""): boolean {
  const searchable = `${attributes} ${label}`.toLowerCase();
  return (
    searchable.includes("application/rss+xml") ||
    searchable.includes("application/atom+xml") ||
    /\brss\b/.test(searchable) ||
    searchable.includes("/feed") ||
    searchable.includes("/events/rss")
  );
}

function discoverAdvertisedRssFeedUrl(
  pageUrl: string,
  contentType: string,
  body: string,
): string | null {
  if (!isHtmlContent(contentType, body)) return null;

  for (const match of body.matchAll(/<link\b([^>]*?)>/gi)) {
    const attributes = match[1];
    const href = attrValue(attributes, "href");
    const resolved = href ? sameOriginUrl(pageUrl, href) : null;
    if (resolved && looksLikeRssLink(attributes)) return resolved;
  }

  for (const match of body.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const label = cleanText(match[2]);
    const href = attrValue(attributes, "href");
    const resolved = href ? sameOriginUrl(pageUrl, href) : null;
    if (resolved && looksLikeRssLink(attributes, label)) return resolved;
  }

  return null;
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
  ].indexOf(monthName.toLowerCase());
  return month >= 0 ? month + 1 : null;
}

function hourFromMeridiem(hour: number, meridiem: string): number {
  const normalized = hour % 12;
  return meridiem.toLowerCase() === "pm" ? normalized + 12 : normalized;
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

function reviewItemForItem(
  target: SourceTargetRecord,
  runId: string,
  fetchedAt: string,
  item: RssItem,
  context: ParserContext = {},
): CreateReviewItemInput {
  const startsAt = extractDescriptionStart(item.description);
  const excerpt = cleanText(item.description);
  const venueName = context.owner?.kind === "venue" ? context.owner.name : "";
  const linkedDrafts = venueName ? [{ type: "venue", name: venueName }] : [];

  if (!startsAt) {
    return {
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
      matchFingerprint: `rss-health:${target.id}:${normalizeForFingerprint(item.title)}:${normalizeForFingerprint(item.link)}`,
      normalizedDraft: {
        issue: "rss-item-missing-event-date",
        title: item.title,
        sourceUrl: item.link,
      },
      fieldDiffs: null,
      linkedDrafts: [],
      conflicts: {
        reason:
          "RSS item has no reliable event date in its description; pubDate was not used as startsAt.",
      },
      evidence: {
        sourceUrls: [item.link],
        excerpts: excerpt ? [excerpt] : [],
        contentHashes: [`${item.link}:missing-date:${parserVersion}`],
      },
      parserVersion,
      fetchTimestamp: fetchedAt,
    };
  }

  const confidence = clampConfidence(68 + target.confidenceAdjustment);

  return {
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
    matchFingerprint: `rss-feed:${normalizeForFingerprint(item.title)}:${normalizeForFingerprint(startsAt)}`,
    normalizedDraft: {
      title: item.title,
      startsAt,
      ...(venueName ? { venueName } : {}),
      styles: normalizeStyleTags(item.categories),
      ticketUrl: item.link,
    },
    fieldDiffs: null,
    linkedDrafts,
    conflicts: null,
    evidence: {
      sourceUrls: [item.link],
      excerpts: [excerpt],
      contentHashes: [`${item.link}:${parserVersion}`],
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
): Promise<CreateReviewItemInput[]> {
  let feedUrl = target.url;
  let result = await fetcher(feedUrl);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`RSS event feed fetch failed with status ${result.status}`);
  }

  if (!isRssContent(feedUrl, result.contentType, result.body)) {
    const discoveredFeedUrl = discoverAdvertisedRssFeedUrl(
      feedUrl,
      result.contentType,
      result.body,
    );
    if (discoveredFeedUrl) {
      feedUrl = discoveredFeedUrl;
      result = await fetcher(feedUrl);
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`RSS event feed fetch failed with status ${result.status}`);
      }
    }
  }

  if (!isRssContent(feedUrl, result.contentType, result.body)) {
    throw new Error("RSS event feed source does not serve structured RSS/XML.");
  }

  const items = parseRssItems(result.body);
  if (items.length === 0) {
    throw new Error("RSS event feed source does not contain RSS/XML event items.");
  }

  return items.map((item) =>
    reviewItemForItem(target, runId, fetchedAt, item, context),
  );
}
