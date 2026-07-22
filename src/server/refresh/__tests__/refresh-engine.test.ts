import { describe, expect, it } from "vitest";

import { createSeedCatalogStore } from "../../catalog/catalog-store";
import { runManualRefresh, listRefreshRunsWithReconciliation } from "../engine";
import { approveReviewItem, rejectReviewItem } from "../review-operations";
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

async function createRssObservationFixture(store: RefreshStore) {
  const owner = await store.createSourceOwner({
    cityId: "city_chicago",
    name: "Smartbar",
    slug: "smartbar-observation",
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
    refreshCadence: "manual",
    notes: "",
  });
  const defaultTitle = "Queen! with Derrick Carter";
  const defaultDescription = `
        <p>Sunday, June 28, 2026</p>
        <p>Doors: 10:00 PM</p>`;
  const fetcherFor = (title: string, description: string) => async () => ({
    body: `<?xml version="1.0"?><rss><channel><item>
      <guid>smartbar-event-42</guid>
      <title>${title}</title>
      <link>https://smartbarchicago.com/event/queen-derrick-carter/</link>
      <description><![CDATA[${description}
      ]]></description>
    </item></channel></rss>`,
    contentType: "application/rss+xml",
    status: 200,
  });
  const fetcherForTitle = (title: string) =>
    fetcherFor(title, defaultDescription);
  const fetcherForDescription = (description: string) =>
    fetcherFor(defaultTitle, description);

  return {
    target,
    fetcher: fetcherForTitle(defaultTitle),
    fetcherForTitle,
    fetcherForDescription,
  };
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

  it("creates and links a source observation when an event is first seen", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher } = await createRssObservationFixture(store);
    const seenAt = new Date("2026-07-11T12:00:00.000Z");

    const result = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: seenAt,
      fetcher,
    });

    expect(result.reviewItems).toHaveLength(1);
    const reviewItem = result.reviewItems[0];
    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      sourceTargetId: target.id,
      sourceEventKey: "smartbar-event-42",
      matchFingerprint: reviewItem.matchFingerprint,
      normalizedCandidate: reviewItem.normalizedDraft,
      firstSeenAt: seenAt.toISOString(),
      lastSeenAt: seenAt.toISOString(),
      lastChangedAt: seenAt.toISOString(),
      latestReviewItemId: reviewItem.id,
      publishedEventId: null,
      parserVersion: reviewItem.parserVersion,
    });
  });

  it("records an unchanged event as seen again without creating review work", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher } = await createRssObservationFixture(store);
    const firstSeenAt = new Date("2026-07-11T12:00:00.000Z");
    const seenAgainAt = new Date("2026-07-11T13:00:00.000Z");

    const firstResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const repeatedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: seenAgainAt,
      fetcher,
    });

    expect(firstResult.reviewItems).toHaveLength(1);
    expect(repeatedResult.run.status).toBe("succeeded");
    expect(repeatedResult.run.draftsCreated).toBe(0);
    expect(repeatedResult.reviewItems).toEqual([]);
    expect(await store.listReviewItems("city_chicago")).toHaveLength(1);

    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      firstSeenAt: firstSeenAt.toISOString(),
      lastSeenAt: seenAgainAt.toISOString(),
      lastChangedAt: firstSeenAt.toISOString(),
      latestReviewItemId: firstResult.reviewItems[0].id,
    });
  });

  it("records a parser upgrade without creating new review work", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher } = await createRssObservationFixture(store);
    const firstSeenAt = new Date("2026-07-11T12:00:00.000Z");
    const upgradedAt = new Date("2026-07-11T13:00:00.000Z");

    const firstResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const reviewItem = firstResult.reviewItems[0];
    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    await store.updateReviewItem(reviewItem.id, {
      evidence: {
        ...reviewItem.evidence,
        contentHashes: reviewItem.evidence.contentHashes.map((hash) =>
          hash.replace("rss-event-feed@1", "rss-event-feed@0"),
        ),
      },
      parserVersion: "rss-event-feed@0",
    });
    await store.updateSourceEventObservation(observation!.id, {
      parserVersion: "rss-event-feed@0",
    });

    const upgradedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: upgradedAt,
      fetcher,
    });

    expect(upgradedResult.run.status).toBe("succeeded");
    expect(upgradedResult.run.draftsCreated).toBe(0);
    expect(upgradedResult.reviewItems).toEqual([]);
    expect(await store.listReviewItems("city_chicago")).toMatchObject([
      {
        id: reviewItem.id,
        evidence: {
          contentHashes: [expect.stringContaining("rss-event-feed@1")],
        },
        parserVersion: "rss-event-feed@1",
      },
    ]);
    expect(
      await store.getSourceEventObservation(
        target.id,
        "smartbar-event-42",
      ),
    ).toMatchObject({
      materialContentHash: observation!.materialContentHash,
      firstSeenAt: firstSeenAt.toISOString(),
      lastSeenAt: upgradedAt.toISOString(),
      lastChangedAt: firstSeenAt.toISOString(),
      latestReviewItemId: reviewItem.id,
      parserVersion: "rss-event-feed@1",
    });
  });

  it("classifies concurrent first sightings atomically without duplicate review work", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher } = await createRssObservationFixture(store);

    const results = await Promise.all([
      runManualRefresh(store, {
        cityId: "city_chicago",
        triggeredBy: "admin-secret-a",
        now: new Date("2026-07-11T12:00:00.000Z"),
        fetcher,
      }),
      runManualRefresh(store, {
        cityId: "city_chicago",
        triggeredBy: "admin-secret-b",
        now: new Date("2026-07-11T12:00:00.000Z"),
        fetcher,
      }),
    ]);

    expect(results.map(({ run }) => run.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(new Set(results.map(({ run }) => run.id)).size).toBe(2);
    expect(
      results.reduce(
        (total, result) => total + result.reviewItems.length,
        0,
      ),
    ).toBe(1);

    const items = await store.listReviewItems("city_chicago");
    expect(items).toHaveLength(1);
    await expect(
      store.getSourceEventObservation(target.id, "smartbar-event-42"),
    ).resolves.toMatchObject({
      latestReviewItemId: items[0].id,
      lastSeenAt: "2026-07-11T12:00:00.000Z",
    });
  });

  it("updates the existing pending review item when observed material changes", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher, fetcherForTitle } =
      await createRssObservationFixture(store);
    const firstSeenAt = new Date("2026-06-20T12:00:00.000Z");
    const changedAt = new Date("2026-06-20T13:00:00.000Z");

    const firstResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const firstItem = firstResult.reviewItems[0];
    const firstObservation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );

    const changedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: changedAt,
      fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
    });

    expect(changedResult.run.status).toBe("succeeded");
    expect(changedResult.run.draftsCreated).toBe(0);
    expect(changedResult.reviewItems).toEqual([]);

    const items = await store.listReviewItems("city_chicago");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: firstItem.id,
      status: "pending",
      normalizedDraft: {
        title: "Queen! with Derrick Carter and Honey Dijon",
      },
      fetchTimestamp: changedAt.toISOString(),
    });

    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      normalizedCandidate: items[0].normalizedDraft,
      firstSeenAt: firstSeenAt.toISOString(),
      lastSeenAt: changedAt.toISOString(),
      lastChangedAt: changedAt.toISOString(),
      latestReviewItemId: firstItem.id,
    });
    expect(observation!.materialContentHash).not.toBe(
      firstObservation!.materialContentHash,
    );
  });

  it("reopens a rejected observation only after its material content changes", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher, fetcherForTitle } =
      await createRssObservationFixture(store);
    const firstSeenAt = new Date("2026-06-20T12:00:00.000Z");
    const unchangedAt = new Date("2026-06-20T13:00:00.000Z");
    const changedAt = new Date("2026-06-20T14:00:00.000Z");

    const firstResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const rejectedItem = firstResult.reviewItems[0];
    const firstObservation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    await rejectReviewItem(
      store,
      rejectedItem.id,
      "admin-secret",
      "Not relevant to Sound City",
    );

    const unchangedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: unchangedAt,
      fetcher,
    });

    expect(unchangedResult.run.status).toBe("succeeded");
    expect(unchangedResult.reviewItems).toEqual([]);
    expect(await store.listReviewItems("city_chicago")).toHaveLength(1);
    expect(
      await store.getSourceEventObservation(target.id, "smartbar-event-42"),
    ).toMatchObject({
      materialContentHash: firstObservation!.materialContentHash,
      lastSeenAt: unchangedAt.toISOString(),
      lastChangedAt: firstSeenAt.toISOString(),
      latestReviewItemId: rejectedItem.id,
    });

    const changedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: changedAt,
      fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
    });

    expect(changedResult.run.status).toBe("succeeded");
    expect(changedResult.run.draftsCreated).toBe(1);
    expect(changedResult.reviewItems).toHaveLength(1);
    const reopenedItem = changedResult.reviewItems[0];
    expect(reopenedItem).toMatchObject({
      status: "pending",
      normalizedDraft: {
        title: "Queen! with Derrick Carter and Honey Dijon",
      },
    });
    expect(reopenedItem.id).not.toBe(rejectedItem.id);

    const items = await store.listReviewItems("city_chicago");
    expect(items.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: rejectedItem.id, status: "rejected" },
      { id: reopenedItem.id, status: "pending" },
    ]);

    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      normalizedCandidate: reopenedItem.normalizedDraft,
      lastSeenAt: changedAt.toISOString(),
      lastChangedAt: changedAt.toISOString(),
      latestReviewItemId: reopenedItem.id,
    });
    expect(observation!.materialContentHash).not.toBe(
      firstObservation!.materialContentHash,
    );
  });

  it("does not reopen rejected review work for evidence-only source changes", async () => {
    const store = createSeedRefreshStore();
    const { target, fetcher, fetcherForDescription } =
      await createRssObservationFixture(store);
    const firstSeenAt = new Date("2026-06-20T12:00:00.000Z");
    const evidenceChangedAt = new Date("2026-06-20T13:00:00.000Z");

    const firstResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const rejectedItem = firstResult.reviewItems[0];
    const firstObservation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    await rejectReviewItem(
      store,
      rejectedItem.id,
      "admin-secret",
      "Not relevant to Sound City",
    );

    const repeatedResult = await runManualRefresh(store, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: evidenceChangedAt,
      fetcher: fetcherForDescription(`
        <div>Sunday, June 28, 2026 — Doors: 10:00 PM</div>
        <p>Feed description formatting was updated.</p>`),
    });

    expect(repeatedResult.run.status).toBe("succeeded");
    expect(repeatedResult.run.draftsCreated).toBe(0);
    expect(repeatedResult.reviewItems).toEqual([]);
    expect(await store.listReviewItems("city_chicago")).toMatchObject([
      {
        id: rejectedItem.id,
        status: "rejected",
        evidence: {
          excerpts: [expect.stringContaining("formatting was updated")],
        },
        fetchTimestamp: evidenceChangedAt.toISOString(),
      },
    ]);

    const observation = await store.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      materialContentHash: firstObservation!.materialContentHash,
      normalizedCandidate: firstObservation!.normalizedCandidate,
      firstSeenAt: firstSeenAt.toISOString(),
      lastSeenAt: evidenceChangedAt.toISOString(),
      lastChangedAt: firstSeenAt.toISOString(),
      latestReviewItemId: rejectedItem.id,
    });
  });

  it("reopens a rejected published-event proposal as another field-level update", async () => {
    const refreshStore = createSeedRefreshStore();
    const catalogStore = createSeedCatalogStore({
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
    const { target, fetcher, fetcherForTitle } =
      await createRssObservationFixture(refreshStore);

    const firstResult = await runManualRefresh(refreshStore, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: new Date("2026-06-20T12:00:00.000Z"),
      fetcher,
    });
    const approval = await approveReviewItem(
      refreshStore,
      catalogStore,
      firstResult.reviewItems[0].id,
      "admin-secret",
    );
    const firstChange = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T13:00:00.000Z"),
        fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
      },
      catalogStore,
    );
    const rejectedProposal = firstChange.reviewItems[0];
    await rejectReviewItem(
      refreshStore,
      rejectedProposal.id,
      "admin-secret",
      "Lineup is not confirmed",
    );

    const unchangedResult = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T14:00:00.000Z"),
        fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
      },
      catalogStore,
    );
    expect(unchangedResult.reviewItems).toEqual([]);

    const revertedResult = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T15:00:00.000Z"),
        fetcher,
      },
      catalogStore,
    );
    expect(revertedResult.run.status).toBe("succeeded");
    expect(revertedResult.run.updatesProposed).toBe(0);
    expect(revertedResult.reviewItems).toEqual([]);
    expect(
      await refreshStore.getSourceEventObservation(
        target.id,
        "smartbar-event-42",
      ),
    ).toMatchObject({
      normalizedCandidate: {
        title: "Queen! with Derrick Carter",
      },
      latestReviewItemId: rejectedProposal.id,
      publishedEventId: approval.publishedEntityId,
      lastChangedAt: "2026-06-20T15:00:00.000Z",
    });

    const changedResult = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T16:00:00.000Z"),
        fetcher: fetcherForTitle("Queen! with Derrick Carter and DJ Heather"),
      },
      catalogStore,
    );

    expect(changedResult.run.status).toBe("succeeded");
    expect(changedResult.run.draftsCreated).toBe(0);
    expect(changedResult.run.updatesProposed).toBe(1);
    expect(changedResult.reviewItems).toHaveLength(1);
    const reopenedProposal = changedResult.reviewItems[0];
    expect(reopenedProposal).toMatchObject({
      lane: "proposed-update",
      status: "pending",
      targetEntityType: "event",
      targetEntityId: approval.publishedEntityId,
      normalizedDraft: {
        title: "Queen! with Derrick Carter and DJ Heather",
      },
      fieldDiffs: {
        title: {
          current: "Queen! with Derrick Carter",
          proposed: "Queen! with Derrick Carter and DJ Heather",
        },
      },
    });
    expect(reopenedProposal.id).not.toBe(rejectedProposal.id);

    expect(
      await refreshStore.getSourceEventObservation(
        target.id,
        "smartbar-event-42",
      ),
    ).toMatchObject({
      latestReviewItemId: reopenedProposal.id,
      publishedEventId: approval.publishedEntityId,
      lastChangedAt: "2026-06-20T16:00:00.000Z",
    });
  });

  it("creates a field-level proposed update for a changed published event", async () => {
    const refreshStore = createSeedRefreshStore();
    const catalogStore = createSeedCatalogStore({
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
    const { target, fetcher, fetcherForTitle } =
      await createRssObservationFixture(refreshStore);
    const firstSeenAt = new Date("2026-06-20T12:00:00.000Z");
    const changedAt = new Date("2026-06-20T13:00:00.000Z");

    const firstResult = await runManualRefresh(refreshStore, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: firstSeenAt,
      fetcher,
    });
    const approval = await approveReviewItem(
      refreshStore,
      catalogStore,
      firstResult.reviewItems[0].id,
      "admin-secret",
      {
        editedDraft: {
          ...firstResult.reviewItems[0].normalizedDraft,
          title: "Admin Curated Queen!",
        },
      },
    );

    const changedResult = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: changedAt,
        fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
      },
      catalogStore,
    );

    expect(changedResult.run.status).toBe("succeeded");
    expect(changedResult.run.updatesProposed).toBe(1);
    expect(changedResult.reviewItems).toHaveLength(1);
    const proposedUpdate = changedResult.reviewItems[0];
    expect(proposedUpdate).toMatchObject({
      lane: "proposed-update",
      status: "pending",
      targetEntityType: "event",
      targetEntityId: approval.publishedEntityId,
      normalizedDraft: {
        title: "Queen! with Derrick Carter and Honey Dijon",
      },
      fieldDiffs: {
        title: {
          current: "Admin Curated Queen!",
          proposed: "Queen! with Derrick Carter and Honey Dijon",
        },
      },
    });
    expect(Object.keys(proposedUpdate.fieldDiffs!)).toEqual(["title"]);

    const observation = await refreshStore.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      normalizedCandidate: proposedUpdate.normalizedDraft,
      lastSeenAt: changedAt.toISOString(),
      lastChangedAt: changedAt.toISOString(),
      latestReviewItemId: proposedUpdate.id,
      publishedEventId: approval.publishedEntityId,
    });
  });

  it("keeps a changed pending proposal linked to its published event", async () => {
    const refreshStore = createSeedRefreshStore();
    const catalogStore = createSeedCatalogStore({
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
    const { target, fetcher, fetcherForTitle } =
      await createRssObservationFixture(refreshStore);

    const firstResult = await runManualRefresh(refreshStore, {
      cityId: "city_chicago",
      triggeredBy: "admin-secret",
      now: new Date("2026-06-20T12:00:00.000Z"),
      fetcher,
    });
    const approval = await approveReviewItem(
      refreshStore,
      catalogStore,
      firstResult.reviewItems[0].id,
      "admin-secret",
    );
    const firstChange = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T13:00:00.000Z"),
        fetcher: fetcherForTitle("Queen! with Derrick Carter and Honey Dijon"),
      },
      catalogStore,
    );
    const proposalId = firstChange.reviewItems[0].id;

    const secondChange = await runManualRefresh(
      refreshStore,
      {
        cityId: "city_chicago",
        triggeredBy: "admin-secret",
        now: new Date("2026-06-20T14:00:00.000Z"),
        fetcher: fetcherForTitle("Queen! with Derrick Carter and DJ Heather"),
      },
      catalogStore,
    );

    expect(secondChange.run.status).toBe("succeeded");
    expect(secondChange.reviewItems).toEqual([]);
    const items = await refreshStore.listReviewItems("city_chicago");
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      id: proposalId,
      lane: "proposed-update",
      status: "pending",
      targetEntityType: "event",
      targetEntityId: approval.publishedEntityId,
      normalizedDraft: {
        title: "Queen! with Derrick Carter and DJ Heather",
      },
      fieldDiffs: {
        title: {
          current: "Queen! with Derrick Carter",
          proposed: "Queen! with Derrick Carter and DJ Heather",
        },
      },
    });

    const observation = await refreshStore.getSourceEventObservation(
      target.id,
      "smartbar-event-42",
    );
    expect(observation).toMatchObject({
      latestReviewItemId: proposalId,
      publishedEventId: approval.publishedEntityId,
      lastChangedAt: "2026-06-20T14:00:00.000Z",
    });
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
