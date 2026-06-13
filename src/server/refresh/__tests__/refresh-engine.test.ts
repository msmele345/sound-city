import { describe, expect, it } from "vitest";

import { runManualRefresh, listRefreshRunsWithReconciliation } from "../engine";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";

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
});
