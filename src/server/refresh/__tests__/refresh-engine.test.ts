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
        expect.stringMatching(/dev parser created 4 review items/i),
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
      parserStrategy: "venue-calendar",
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
    expect(result.run.errorSummary).toMatch(/no phase 3 parser/i);

    const logs = await store.listRunLogs(result.run.id);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          message: expect.stringMatching(/no phase 3 parser/i),
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
      parserStrategy: "venue-calendar",
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
    expect(updated!.lastFailureReason).toMatch(/no phase 3 parser/i);
  });
});
