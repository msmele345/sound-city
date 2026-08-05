import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createExternalFetcher,
  type ExternalTransportRequest,
} from "../external-fetcher";
import { parseRssEventFeedTarget } from "../rss-event-feed-parser";
import type { Fetcher, SourceOwnerRecord, SourceTargetRecord } from "../types";

async function* responseBody(body: string) {
  yield Buffer.from(body);
}

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
    etag: null,
    lastModified: null,
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

const radiusDetailUrl =
  "https://www.radius-chicago.com/events/detail/1000001";
const radiusGuid = radiusDetailUrl;

function createRadiusTarget(): SourceTargetRecord {
  return createTarget({
    id: "target_radius_rss",
    ownerId: "owner_radius",
    url: "https://www.radius-chicago.com/events/rss",
  });
}

const certifiedSmartbarRss = readFileSync(
  resolve(
    process.cwd(),
    "src/server/refresh/__tests__/fixtures/smartbar-rss.xml",
  ),
  "utf8",
);
const certifiedRadiusRss = readFileSync(
  resolve(
    process.cwd(),
    "src/server/refresh/__tests__/fixtures/radius-rss.xml",
  ),
  "utf8",
);
const certifiedRadiusDetail = readFileSync(
  resolve(
    process.cwd(),
    "src/server/refresh/__tests__/fixtures/radius-event-detail.html",
  ),
  "utf8",
);

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
  it("uses the Radius RSS guid as the stable source event key", async () => {
    const fetcher: Fetcher = async () => ({
      body: certifiedRadiusRss,
      contentType: "application/rss+xml",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      createRadiusTarget(),
      "run_radius_identity",
      "2026-08-04T12:00:00.000Z",
      fetcher,
    );

    expect(candidate.sourceEventKey).toBe(radiusGuid);
  });

  it("normalizes the Radius RSS title and extracts its event date without inventing a time", async () => {
    const fetcher: Fetcher = async () => ({
      body: certifiedRadiusRss,
      contentType: "application/rss+xml",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      createRadiusTarget(),
      "run_radius_title",
      "2026-08-04T12:00:00.000Z",
      fetcher,
    );

    expect(candidate.normalizedDraft).toMatchObject({
      title: "Market Nights 2026",
      eventDate: "2026-08-07",
    });
    expect(candidate.normalizedDraft).not.toHaveProperty("startsAt");
  });

  it("enriches a Radius item only from the detail URL supplied by its RSS entry", async () => {
    const target = createRadiusTarget();
    const fetcher = vi.fn<Fetcher>(async (url) => {
      if (url === target.url) {
        return {
          body: certifiedRadiusRss,
          contentType: "application/rss+xml",
          status: 200,
        };
      }
      if (url === radiusDetailUrl) {
        return {
          body: certifiedRadiusDetail,
          contentType: "text/html",
          status: 200,
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await parseRssEventFeedTarget(
      target,
      "run_radius_detail",
      "2026-08-04T12:00:00.000Z",
      fetcher,
    );

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      target.url,
      radiusDetailUrl,
    ]);
  });

  it("captures labeled Radius event time, doors, age policy, and ticket URL from the detail fixture", async () => {
    const target = createRadiusTarget();
    const fetcher: Fetcher = async (url) => ({
      body: url === target.url ? certifiedRadiusRss : certifiedRadiusDetail,
      contentType:
        url === target.url ? "application/rss+xml" : "text/html; charset=UTF-8",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      target,
      "run_radius_labeled_fields",
      "2026-08-04T12:00:00.000Z",
      fetcher,
    );

    expect(candidate.normalizedDraft).toMatchObject({
      title: "Market Nights 2026",
      eventDate: "2026-08-07",
      startsAt: "2026-08-08T02:30:00.000Z",
      doorsAt: "2026-08-08T01:00:00.000Z",
      agePolicy: "21+",
      ticketUrl:
        "https://www.axs.com/events/1000001/market-nights-tickets?skin=radius",
    });
  });

  it("blocks a Radius detail redirect to an arbitrary public host", async () => {
    const target = createRadiusTarget();
    const transport = vi.fn(async ({ url }: ExternalTransportRequest) => {
      if (url.toString() === target.url) {
        return {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
          body: responseBody(certifiedRadiusRss),
        };
      }
      if (url.toString() === radiusDetailUrl) {
        return {
          status: 302,
          headers: { location: "https://arbitrary.example/events/1000001" },
          body: responseBody(""),
        };
      }
      return {
        status: 200,
        headers: { "content-type": "text/html" },
        body: responseBody("<main>unexpected escaped detail page</main>"),
      };
    });
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(
      parseRssEventFeedTarget(
        target,
        "run_radius_host_policy",
        "2026-08-04T12:00:00.000Z",
        fetcher,
      ),
    ).rejects.toThrow(/outside the allowed hosts/i);
    expect(transport.mock.calls.map(([request]) => request.url.toString())).toEqual([
      target.url,
      radiusDetailUrl,
    ]);
  });

  it("parses the certified Smartbar compact description and cleans entities", async () => {
    const fetcher: Fetcher = async () => ({
      body: certifiedSmartbarRss,
      contentType: "text/xml; charset=UTF-8",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      createTarget(),
      "run_certification",
      "2026-07-31T13:32:13.000Z",
      fetcher,
      { owner: createOwner() },
    );

    expect(candidate.sourceEventKey).toBe(
      "https://smartbarchicago.com/event/signal-flow/",
    );
    expect(candidate.normalizedDraft).toEqual({
      title: "Signal Flow & Friends",
      startsAt: "2026-09-19T03:00:00.000Z",
      doorsAt: "2026-09-19T03:00:00.000Z",
      venueName: "Smartbar",
      lineup: ["Artist One", "Artist Two", "DJ O’Three"],
      price:
        "$20-$25 Adv / $25 Door / $20 Student Door (before 12am with valid ID)",
      agePolicy: "21+",
      styles: [],
      canonicalUrl: "https://smartbarchicago.com/event/signal-flow/",
      ticketUrl: "https://smartbarchicago.com/event/signal-flow/",
    });
    expect(candidate.evidence.sourceUrls).toEqual([
      "https://smartbarchicago.com/event/signal-flow/",
    ]);
    expect(candidate.evidence.excerpts[0]).toContain("Signal Flow & Friends");
    expect(candidate.evidence.excerpts[0]).toContain("DJ O’Three");
  });

  it("treats tag-shaped text inside legal CDATA as description content", async () => {
    const fetcher: Fetcher = async () => ({
      body: certifiedSmartbarRss.replace(
        "Night Moves presents",
        "Night Moves </item> presents",
      ),
      contentType: "text/xml; charset=UTF-8",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      createTarget(),
      "run_cdata",
      "2026-07-31T13:32:13.000Z",
      fetcher,
      { owner: createOwner() },
    );

    expect(candidate).toMatchObject({
      lane: "new-event",
      normalizedDraft: {
        title: "Signal Flow & Friends",
        startsAt: "2026-09-19T03:00:00.000Z",
      },
    });
    expect(candidate.evidence.excerpts[0]).toContain("Night Moves presents");
  });

  it("rejects a malformed RSS document instead of parsing a partial tree", async () => {
    const fetcher: Fetcher = async () => ({
      body: certifiedSmartbarRss.replace("  </channel>\n</rss>\n", ""),
      contentType: "text/xml; charset=UTF-8",
      status: 200,
    });

    await expect(
      parseRssEventFeedTarget(
        createTarget(),
        "run_malformed_document",
        "2026-07-31T13:32:13.000Z",
        fetcher,
        { owner: createOwner() },
      ),
    ).rejects.toThrow(/malformed rss\/xml document/i);
  });

  it("retains a certified event when a sibling item is incomplete", async () => {
    const malformedSibling = `
    <item>
      <title>Recently announced Smartbar night</title>
      <link>https://smartbarchicago.com/event/recently-announced/</link>
      <description>Lineup and ticket details coming soon.</description>
    </item>`;
    const fetcher: Fetcher = async () => ({
      body: certifiedSmartbarRss.replace(
        "  </channel>",
        `${malformedSibling}\n  </channel>`,
      ),
      contentType: "text/xml; charset=UTF-8",
      status: 200,
    });

    const candidates = await parseRssEventFeedTarget(
      createTarget(),
      "run_malformed_sibling",
      "2026-07-31T13:32:13.000Z",
      fetcher,
      { owner: createOwner() },
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        lane: "new-event",
        normalizedDraft: expect.objectContaining({
          title: "Signal Flow & Friends",
        }),
      }),
      expect.objectContaining({
        lane: "source-health",
        normalizedDraft: expect.objectContaining({
          issue: "rss-item-missing-event-date",
          title: "Recently announced Smartbar night",
        }),
      }),
    ]);
  });

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
      parserVersion: "rss-event-feed@4",
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
        "https://smartbarchicago.com/event/queen-derrick-carter/:rss-event-feed@4",
      ],
    });
    expect(items[0].matchFingerprint).toBe(
      "queen-with-derrick-carter:2026-06-29t03-00-00-000z",
    );
  });

  it("uses the RSS guid as source identity while keeping comparison identities separate", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: smartbarRss.replace(
        "<link>https://smartbarchicago.com/event/queen-derrick-carter/</link>",
        "<guid>smartbar-event-42</guid><link>https://smartbarchicago.com/event/queen-derrick-carter/</link>",
      ),
      contentType: "application/rss+xml; charset=utf-8",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      target,
      "run_1",
      "2026-06-17T20:00:00.000Z",
      fetcher,
      { owner: createOwner() },
    );

    expect(candidate.sourceEventKey).toBe("smartbar-event-42");
    expect(candidate.matchFingerprint).toBe(
      "queen-with-derrick-carter:2026-06-29t03-00-00-000z:smartbar",
    );
    expect(candidate.materialContentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses a canonical item link as source identity when the RSS guid is absent", async () => {
    const fetcher: Fetcher = async () => ({
      body: smartbarRss.replace(
        /queen-derrick-carter\//g,
        "queen-derrick-carter/?utm_source=rss",
      ),
      contentType: "application/rss+xml; charset=utf-8",
      status: 200,
    });

    const [candidate] = await parseRssEventFeedTarget(
      createTarget(),
      "run_1",
      "2026-06-17T20:00:00.000Z",
      fetcher,
    );

    expect(candidate.sourceEventKey).toBe(
      "https://smartbarchicago.com/event/queen-derrick-carter/",
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
      parserVersion: "rss-event-feed@4",
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
