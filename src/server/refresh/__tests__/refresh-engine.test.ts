import { describe, expect, it } from "vitest";

import { createSeedCatalogStore } from "../../catalog/catalog-store";
import { runManualRefresh, listRefreshRunsWithReconciliation } from "../engine";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { CatalogStore } from "../../catalog/catalog-store";

async function createDevTarget(store: RefreshStore) {
  const owner = await store.createSourceOwner({
    cityId: "city_chicago",
    name: "Fixture Venue",
    slug: "fixture-venue",
    kind: "venue",
    notes: "",
  });

  return store.createSourceTarget({
    ownerId: owner.id,
    cityId: "city_chicago",
    url: "https://fixtures.sound-city.test/dev-static",
    sourceType: "other",
    parserStrategy: "dev-static",
    trustLevel: "experimental",
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy",
    refreshCadence: "manual",
    notes: "",
  });
}

function createCatalogWithPastEvent(
  startsAt = "2026-05-30T03:00:00.000Z",
): CatalogStore {
  const catalog = createSeedCatalogStore({
    cities: [
      {
        id: "city_chicago",
        name: "Chicago",
        slug: "chicago",
        timeZone: "America/Chicago",
      },
    ],
    venues: [],
    artists: [],
    events: [],
  });
  const venue = {
    id: "venue_past",
    citySlug: "chicago",
    name: "Past Venue",
    slug: "past-venue",
    neighborhood: "Test",
    address: "123 Test St",
    capacity: null,
    source: {
      id: "source_past_venue",
      title: "Past Venue",
      url: "https://past-venue.test",
      lastVerifiedAt: "2026-05-15",
    },
    signals: [],
  };
  catalog.createVenue(venue);
  catalog.createEvent({
    id: "event_past_listing",
    citySlug: "chicago",
    title: "Past Listing",
    slug: "past-listing",
    startsAt,
    venue,
    artists: [],
    styles: ["techno"],
    source: {
      id: "source_past_event",
      title: "Past Listing",
      url: "https://past-venue.test/event",
      lastVerifiedAt: "2026-05-15",
    },
  });
  return catalog;
}

describe("refresh engine", () => {
  it("runs the dev parser and creates durable review lanes with metrics", async () => {
    const store = createSeedRefreshStore();
    const target = await createDevTarget(store);

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });

    expect(result.run.status).toBe("succeeded");
    expect(result.run.startedAt).not.toBeNull();
    expect(result.run.finishedAt).not.toBeNull();
    expect(result.run.sourceTargetsChecked).toBe(1);
    expect(result.run.sourceTargetsFailed).toBe(0);
    expect(result.run.draftsCreated).toBe(1);
    expect(result.run.updatesProposed).toBe(1);
    expect(result.run.duplicatesFlagged).toBe(1);
    expect(result.run.staleTasksCreated).toBe(1);

    const items = await store.listReviewItems("city_chicago");
    expect(items.map((item) => item.lane).sort()).toEqual([
      "new-event",
      "possible-duplicate",
      "proposed-update",
      "stale-task",
    ]);
    expect(items.every((item) => item.sourceTargetId === target.id)).toBe(true);
    expect(items[0].evidence.sourceUrls).toContain(target.url);

    const logs = await store.listRunLogs(result.run.id);
    expect(logs.map((log) => log.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/refresh run started/i),
        expect.stringMatching(/dev-static parser created 4 review items/i),
        expect.stringMatching(/refresh run completed/i),
      ]),
    );
  });

  it("does not enqueue the same review fingerprints on repeated refreshes", async () => {
    const store = createSeedRefreshStore();
    await createDevTarget(store);

    const first = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });
    const second = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });

    expect(first.reviewItems).toHaveLength(4);
    expect(second.reviewItems).toHaveLength(0);
    expect(await store.listReviewItems("city_chicago")).toHaveLength(4);
    expect(second.run.draftsCreated).toBe(0);
    expect(second.run.updatesProposed).toBe(0);
    expect(second.run.duplicatesFlagged).toBe(0);
    expect(second.run.staleTasksCreated).toBe(0);
  });

  it("does not enqueue a new-event candidate already present in the catalog", async () => {
    const store = createSeedRefreshStore();
    await createDevTarget(store);
    const catalog = createSeedCatalogStore({
      cities: [
        {
          id: "city_chicago",
          name: "Chicago",
          slug: "chicago",
          timeZone: "America/Chicago",
        },
      ],
      venues: [
        {
          id: "venue_fixture_warehouse",
          citySlug: "chicago",
          name: "Fixture Warehouse",
          slug: "fixture-warehouse",
          neighborhood: "West Loop",
          address: "TBD",
          capacity: null,
          source: {
            id: "source_fixture_warehouse",
            title: "Fixture Warehouse",
            url: "https://fixtures.sound-city.test/dev-static",
            lastVerifiedAt: "2026-06-01T00:00:00.000Z",
          },
          signals: [],
        },
      ],
      artists: [],
      events: [],
    });
    const [venue] = await catalog.listVenues("chicago");
    await catalog.createEvent({
      id: "event_late_shift_control_room",
      citySlug: "chicago",
      title: "Late Shift Control Room",
      slug: "late-shift-control-room",
      startsAt: "2026-06-19T04:00:00.000Z",
      venue,
      artists: [],
      styles: ["house", "groovy"],
      source: {
        id: "source_event_late-shift-control-room",
        title: "Late Shift Control Room",
        url: "https://fixtures.sound-city.test/dev-static/late-shift",
        lastVerifiedAt: "2026-06-01T00:00:00.000Z",
      },
    });

    const result = await runManualRefresh(
      store,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-01T00:00:00.000Z"),
      },
      catalog,
    );

    expect(
      result.reviewItems.some(
        (item) => item.matchFingerprint === "fixture-new-late-shift",
      ),
    ).toBe(false);
    expect(result.run.draftsCreated).toBe(0);
  });

  it("marks unsupported enabled targets as partial and records visible errors", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar",
      sourceType: "official-venue-calendar",
      parserStrategy: "artist-social",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.sourceTargetsChecked).toBe(1);
    expect(result.run.sourceTargetsFailed).toBe(1);
    expect(result.run.errorSummary).toMatch(/no parser is available/i);

    const logs = await store.listRunLogs(result.run.id);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          message: expect.stringMatching(/no parser is available/i),
        }),
      ]),
    );
  });

  it("reconciles orphaned running runs when run history is read", async () => {
    const store = createSeedRefreshStore();
    const run = await store.createRefreshRun({
      cityId: "city_chicago",
      trigger: "manual",
      triggeredBy: "admin-secret",
    });
    await store.updateRefreshRun(run.id, {
      status: "running",
      startedAt: "2026-06-12T10:00:00.000Z",
    });

    const runs = await listRefreshRunsWithReconciliation(store, "city_chicago", {
      now: new Date("2026-06-12T10:30:00.000Z"),
      maxRunAgeMs: 60_000,
    });

    expect(runs[0]).toMatchObject({
      id: run.id,
      status: "failed",
      errorSummary: expect.stringMatching(/reconciled/i),
    });
    expect(runs[0].finishedAt).toBe("2026-06-12T10:30:00.000Z");
  });

  it("creates stale tasks for past events when a catalog store is provided", async () => {
    const store = createSeedRefreshStore();
    const catalog = createCatalogWithPastEvent("2026-05-30T03:00:00.000Z");
    await createDevTarget(store);

    const result = await runManualRefresh(
      store,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-13T00:00:00.000Z"),
      },
      catalog,
    );

    expect(result.run.staleTasksCreated).toBeGreaterThanOrEqual(2); // fixture + past event
    const staleTasks = result.reviewItems.filter(
      (item) => item.lane === "stale-task",
    );
    const pastEventTask = staleTasks.find(
      (item) => item.targetEntityId === "event_past_listing",
    );
    expect(pastEventTask).toBeDefined();
    expect(pastEventTask!.sourceTargetId).toBeNull();
    expect(pastEventTask!.normalizedDraft).toMatchObject({
      title: "Past Listing",
      action: "review-past-event",
    });

    const events = await catalog.listEvents("chicago");
    expect(events.find((e) => e.id === "event_past_listing")).toBeDefined();
  });

  it("does not auto-delete or auto-archive catalog records when creating stale tasks", async () => {
    const store = createSeedRefreshStore();
    const catalog = createCatalogWithPastEvent("2026-05-30T03:00:00.000Z");
    await createDevTarget(store);

    const before = await catalog.listEvents("chicago");
    expect(before).toHaveLength(1);

    await runManualRefresh(
      store,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-13T00:00:00.000Z"),
      },
      catalog,
    );

    const after = await catalog.listEvents("chicago");
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe("event_past_listing");
  });

  it("records per-target failure and duplicate counters", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Fixture Venue",
      slug: "fixture-venue",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://fixtures.sound-city.test/dev-static",
      sourceType: "other",
      parserStrategy: "dev-static",
      trustLevel: "experimental",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "manual",
      notes: "",
    });

    await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.duplicateCount).toBe(1);
    expect(updated!.failureCount).toBe(0);
    expect(updated!.lastSuccessfulRunAt).not.toBeNull();
  });

  it("increments failure counter and timestamps when a target fails", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar",
      sourceType: "official-venue-calendar",
      parserStrategy: "artist-social",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
    });

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.failureCount).toBe(1);
    expect(updated!.lastFailureAt).not.toBeNull();
    expect(updated!.lastFailureReason).toMatch(/no parser is available/i);
  });

  it("runs the venue-calendar parser with a mock fetcher and creates review items from ICS", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar.ics",
      sourceType: "official-venue-calendar",
      parserStrategy: "venue-calendar",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    const icsBody = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Smartbar//EN",
      "BEGIN:VEVENT",
      "UID:smartbar-1@sound-city.test",
      "DTSTART:20260620T220000Z",
      "DTEND:20260621T030000Z",
      "SUMMARY:Warehouse Sessions",
      "LOCATION:Smartbar\\, Chicago",
      "URL:https://smartbarchicago.com/events/warehouse-sessions",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:smartbar-2@sound-city.test",
      "DTSTART:20260627T220000Z",
      "SUMMARY:Late Night Techno",
      "LOCATION:Smartbar\\, Chicago",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const mockFetcher = async () => ({
      body: icsBody,
      contentType: "text/calendar",
      status: 200,
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      fetcher: mockFetcher,
    });

    expect(result.run.status).toBe("succeeded");
    expect(result.run.sourceTargetsChecked).toBe(1);
    expect(result.run.sourceTargetsFailed).toBe(0);
    expect(result.run.draftsCreated).toBe(2);

    const items = result.reviewItems.filter(
      (item) => item.lane === "new-event",
    );
    expect(items).toHaveLength(2);
    expect(items[0].normalizedDraft).toMatchObject({
      title: "Warehouse Sessions",
      venueName: "Smartbar, Chicago",
    });
    expect(items[0].evidence.sourceUrls).toEqual([
      "https://smartbarchicago.com/events/warehouse-sessions",
    ]);
    expect(items[0].evidence.contentHashes).toEqual([
      "smartbar-1@sound-city.test:venue-calendar@1",
    ]);
    expect(items[0].parserVersion).toBe("venue-calendar@1");
    expect(items[0].linkedDrafts).toEqual([
      { type: "venue", name: "Smartbar, Chicago" },
    ]);
    expect(items[0].sourceTargetId).toBe(target.id);

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.lastSuccessfulRunAt).not.toBeNull();
    expect(updated!.failureCount).toBe(0);
  });

  it("runs the RSS event feed parser and creates review items from XML", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/events/feed/",
      sourceType: "official-venue-calendar",
      parserStrategy: "rss-event-feed",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    const rssBody = `<?xml version="1.0"?><rss><channel><item>
      <title>Queen! with Derrick Carter</title>
      <link>https://smartbarchicago.com/event/queen-derrick-carter/</link>
      <pubDate>Mon, 01 Jun 2026 15:00:00 -0500</pubDate>
      <description><![CDATA[
        <p>Sunday, June 28, 2026</p>
        <p>Doors: 10:00 PM</p>
      ]]></description>
    </item></channel></rss>`;
    const mockFetcher = async () => ({
      body: rssBody,
      contentType: "application/rss+xml",
      status: 200,
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      fetcher: mockFetcher,
    });

    expect(result.run.status).toBe("succeeded");
    expect(result.run.sourceTargetsChecked).toBe(1);
    expect(result.run.sourceTargetsFailed).toBe(0);
    expect(result.run.draftsCreated).toBe(1);

    expect(result.reviewItems).toHaveLength(1);
    expect(result.reviewItems[0]).toMatchObject({
      lane: "new-event",
      sourceTargetId: target.id,
      parserVersion: "rss-event-feed@1",
    });
    expect(result.reviewItems[0].normalizedDraft).toMatchObject({
      title: "Queen! with Derrick Carter",
      venueName: "Smartbar",
      startsAt: "2026-06-29T03:00:00.000Z",
      ticketUrl: "https://smartbarchicago.com/event/queen-derrick-carter/",
    });
    expect(result.reviewItems[0].linkedDrafts).toEqual([
      { type: "venue", name: "Smartbar" },
    ]);

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.lastSuccessfulRunAt).not.toBeNull();
    expect(updated!.failureCount).toBe(0);
  });

  it("marks RSS event feed targets as failed and logs parser failures", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/events/feed/",
      sourceType: "official-venue-calendar",
      parserStrategy: "rss-event-feed",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });
    const mockFetcher = async () => ({
      body: "<html><body>JavaScript required</body></html>",
      contentType: "text/html",
      status: 200,
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      fetcher: mockFetcher,
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.sourceTargetsFailed).toBe(1);
    expect(result.run.errorSummary).toMatch(/rss\/xml/i);

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.failureCount).toBe(1);
    expect(updated!.lastFailureReason).toMatch(/rss\/xml/i);

    const logs = await store.listRunLogs(result.run.id);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTargetId: target.id,
          level: "error",
          message: expect.stringMatching(/rss\/xml/i),
          metadata: { parserStrategy: "rss-event-feed" },
        }),
      ]),
    );
  });

  it("marks venue-calendar target as failed when fetch returns non-ICS content", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar",
      sourceType: "official-venue-calendar",
      parserStrategy: "venue-calendar",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    const mockFetcher = async () => ({
      body: "<html><body>JavaScript required</body></html>",
      contentType: "text/html",
      status: 200,
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      fetcher: mockFetcher,
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.sourceTargetsFailed).toBe(1);
    expect(result.run.errorSummary).toMatch(/structured feed/i);

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.failureCount).toBe(1);
    expect(updated!.lastFailureReason).toMatch(/structured feed/i);
  });

  it("marks venue-calendar target as failed when fetch returns non-200 status", async () => {
    const store = createSeedRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    });
    const target = await store.createSourceTarget({
      ownerId: owner.id,
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar.ics",
      sourceType: "official-venue-calendar",
      parserStrategy: "venue-calendar",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      notes: "",
    });

    const mockFetcher = async () => ({
      body: "Not Found",
      contentType: "text/plain",
      status: 404,
    });

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      fetcher: mockFetcher,
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.errorSummary).toMatch(/status 404/i);

    const updated = await store.getSourceTarget(target.id);
    expect(updated!.failureCount).toBe(1);
  });
});
