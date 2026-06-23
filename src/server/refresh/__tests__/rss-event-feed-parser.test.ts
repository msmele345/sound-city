import { describe, expect, it } from "vitest";

import { parseRssEventFeedTarget } from "../rss-event-feed-parser";
import type { Fetcher, SourceOwnerRecord, SourceTargetRecord } from "../types";

function createTarget(
  overrides: Partial<SourceTargetRecord> = {},
): SourceTargetRecord {
  return {
    id: "target_smartbar_rss",
    ownerId: "owner_smartbar",
    cityId: "city_chicago",
    url: "https://smartbarchicago.com/events/feed/",
    sourceType: "official-venue-calendar",
    parserStrategy: "rss-event-feed",
    trustLevel: "primary",
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy",
    failureCount: 0,
    rejectionCount: 0,
    duplicateCount: 0,
    refreshCadence: "daily",
    lastFetchedAt: null,
    lastSuccessfulRunAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    notes: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const smartbarRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Smartbar Events</title>
    <item>
      <title>Queen! with Derrick Carter</title>
      <link>https://smartbarchicago.com/event/queen-derrick-carter/</link>
      <pubDate>Mon, 01 Jun 2026 15:00:00 -0500</pubDate>
      <category>Melodic Techno</category>
      <category>groovy-techno</category>
      <description><![CDATA[
        <p>Sunday, June 28, 2026</p>
        <p>Doors: 10:00 PM</p>
        <p>21+ / Smartbar / $20 advance</p>
      ]]></description>
    </item>
  </channel>
</rss>`;

function createOwner(
  overrides: Partial<SourceOwnerRecord> = {},
): SourceOwnerRecord {
  return {
    id: "owner_smartbar",
    cityId: "city_chicago",
    name: "Smartbar",
    slug: "smartbar",
    kind: "venue",
    notes: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseRssEventFeedTarget", () => {
  it("creates low-confidence review items from Smartbar-shaped RSS items", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: smartbarRss,
      contentType: "application/rss+xml; charset=utf-8",
      status: 200,
    });

    const items = await parseRssEventFeedTarget(
      target,
      "run_1",
      "2026-06-17T20:00:00.000Z",
      fetcher,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cityId: "city_chicago",
      runId: "run_1",
      sourceTargetId: "target_smartbar_rss",
      lane: "new-event",
      targetEntityType: "event",
      targetEntityId: null,
      parserVersion: "rss-event-feed@1",
      fetchTimestamp: "2026-06-17T20:00:00.000Z",
    });
    expect(items[0].confidence).toBeLessThan(82);
    expect(items[0].confidenceReasons).toEqual([
      "official venue RSS feed",
      "event date extracted from item description",
      "RSS description requires admin verification",
    ]);
    expect(items[0].normalizedDraft).toMatchObject({
      title: "Queen! with Derrick Carter",
      startsAt: "2026-06-29T03:00:00.000Z",
      ticketUrl: "https://smartbarchicago.com/event/queen-derrick-carter/",
      styles: ["melodic", "groovy"],
    });
    expect(items[0].evidence).toEqual({
      sourceUrls: ["https://smartbarchicago.com/event/queen-derrick-carter/"],
      excerpts: [
        "Sunday, June 28, 2026 Doors: 10:00 PM 21+ / Smartbar / $20 advance",
      ],
      contentHashes: [
        "https://smartbarchicago.com/event/queen-derrick-carter/:rss-event-feed@1",
      ],
    });
    expect(items[0].matchFingerprint).toBe(
      "rss-feed:queen-with-derrick-carter:2026-06-29t03-00-00-000z",
    );
  });

  it("pre-links venue-owned RSS review items to the source owner venue", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: smartbarRss,
      contentType: "application/rss+xml; charset=utf-8",
      status: 200,
    });

    const items = await parseRssEventFeedTarget(
      target,
      "run_1",
      "2026-06-17T20:00:00.000Z",
      fetcher,
      { owner: createOwner() },
    );

    expect(items).toHaveLength(1);
    expect(items[0].normalizedDraft).toMatchObject({
      venueName: "Smartbar",
    });
    expect(items[0].linkedDrafts).toEqual([{ type: "venue", name: "Smartbar" }]);
  });

  it("flags RSS items without reliable event dates as source-health issues", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: `<?xml version="1.0"?><rss><channel><item>
        <title>Recently announced Smartbar night</title>
        <link>https://smartbarchicago.com/event/recently-announced/</link>
        <pubDate>Mon, 01 Jun 2026 15:00:00 -0500</pubDate>
        <description>Lineup and ticket details coming soon.</description>
      </item></channel></rss>`,
      contentType: "application/rss+xml",
      status: 200,
    });

    const items = await parseRssEventFeedTarget(
      target,
      "run_1",
      "2026-06-17T20:00:00.000Z",
      fetcher,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      lane: "source-health",
      confidence: 20,
      targetEntityType: "source-target",
      targetEntityId: "target_smartbar_rss",
      parserVersion: "rss-event-feed@1",
    });
    expect(items[0].normalizedDraft).toMatchObject({
      issue: "rss-item-missing-event-date",
      title: "Recently announced Smartbar night",
      sourceUrl: "https://smartbarchicago.com/event/recently-announced/",
    });
    expect(items[0].conflicts).toMatchObject({
      reason: expect.stringMatching(/event date/i),
    });
  });
});
