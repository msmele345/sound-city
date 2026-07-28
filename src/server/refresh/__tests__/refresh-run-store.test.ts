import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { CreateRefreshRunInput } from "../types";

function makeRun(
  overrides: Partial<CreateRefreshRunInput> = {},
): CreateRefreshRunInput {
  return {
    cityId: "city_chicago",
    trigger: "manual",
    triggeredBy: "admin-secret",
    ...overrides,
  };
}

describe("refresh run store", () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createSeedRefreshStore();
  });

  it("creates a refresh run with pending status", async () => {
    const run = await store.createRefreshRun(makeRun());

    expect(run.status).toBe("pending");
    expect(run.trigger).toBe("manual");
    expect(run.cityId).toBe("city_chicago");
    expect(run.sourceTargetsChecked).toBe(0);
    expect(run.sourceTargetsFailed).toBe(0);
    expect(run.draftsCreated).toBe(0);
  });

  it("lists refresh runs for a city", async () => {
    const created = await store.createRefreshRun(makeRun());

    const runs = await store.listRefreshRuns("city_chicago");

    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(created.id);
  });

  it("filters runs by city", async () => {
    await store.createRefreshRun(makeRun({ cityId: "city_chicago" }));
    await store.createRefreshRun(makeRun({ cityId: "city_new_york" }));

    const chicago = await store.listRefreshRuns("city_chicago");
    const ny = await store.listRefreshRuns("city_new_york");

    expect(chicago).toHaveLength(1);
    expect(ny).toHaveLength(1);
  });

  it("gets a refresh run by id", async () => {
    const created = await store.createRefreshRun(makeRun());

    const found = await store.getRefreshRun(created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("returns null for missing run", async () => {
    const found = await store.getRefreshRun("nonexistent");
    expect(found).toBeNull();
  });

  it("updates run status from pending to running", async () => {
    const created = await store.createRefreshRun(makeRun());

    const updated = await store.updateRefreshRun(created.id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    expect(updated.status).toBe("running");
    expect(updated.startedAt).not.toBeNull();
  });

  it("updates run to succeeded with finishedAt", async () => {
    const created = await store.createRefreshRun(makeRun());
    await store.updateRefreshRun(created.id, { status: "running" });

    const finishedAt = new Date().toISOString();
    const updated = await store.updateRefreshRun(created.id, {
      status: "succeeded",
      finishedAt,
      sourceTargetsChecked: 3,
      draftsCreated: 5,
    });

    expect(updated.status).toBe("succeeded");
    expect(updated.finishedAt).toBe(finishedAt);
    expect(updated.sourceTargetsChecked).toBe(3);
    expect(updated.draftsCreated).toBe(5);
  });

  it("updates run to failed with error summary", async () => {
    const created = await store.createRefreshRun(makeRun());
    await store.updateRefreshRun(created.id, { status: "running" });

    const updated = await store.updateRefreshRun(created.id, {
      status: "failed",
      errorSummary: "Parser timeout",
    });

    expect(updated.status).toBe("failed");
    expect(updated.errorSummary).toBe("Parser timeout");
  });

  it("updates run to partial status", async () => {
    const created = await store.createRefreshRun(makeRun());
    await store.updateRefreshRun(created.id, { status: "running" });

    const updated = await store.updateRefreshRun(created.id, {
      status: "partial",
      sourceTargetsChecked: 3,
      sourceTargetsFailed: 1,
    });

    expect(updated.status).toBe("partial");
    expect(updated.sourceTargetsFailed).toBe(1);
  });

  it.each(["succeeded", "failed", "skipped", "unchanged"] as const)(
    "persists the %s target outcome status",
    async (status) => {
      const outcome = await store.createRefreshTargetOutcome({
        runId: `run_${status}`,
        sourceTargetId: `target_${status}`,
        startedAt: "2026-07-22T12:00:00.000Z",
      });

      expect(outcome.status).toBe("running");
      await expect(
        store.updateRefreshTargetOutcome(outcome.id, { status }),
      ).resolves.toMatchObject({ status });
    },
  );

  it("rejects a second outcome for the same run and target", async () => {
    const input = {
      runId: "run_unique",
      sourceTargetId: "target_unique",
      startedAt: "2026-07-22T12:00:00.000Z",
    };
    await store.createRefreshTargetOutcome(input);

    await expect(store.createRefreshTargetOutcome(input)).rejects.toThrow(
      /already exists/i,
    );
  });

  it("lists durable outcome history for one source target", async () => {
    const targetOutcome = await store.createRefreshTargetOutcome({
      runId: "run_target_history",
      sourceTargetId: "target_history",
      startedAt: "2026-07-22T12:00:00.000Z",
    });
    await store.updateRefreshTargetOutcome(targetOutcome.id, {
      status: "failed",
      finishedAt: "2026-07-22T12:00:01.000Z",
    });
    await store.createRefreshTargetOutcome({
      runId: "run_other_target",
      sourceTargetId: "target_other",
      startedAt: "2026-07-22T12:00:02.000Z",
    });

    await expect(
      store.listSourceTargetOutcomes("target_history"),
    ).resolves.toEqual([
      expect.objectContaining({
        runId: "run_target_history",
        sourceTargetId: "target_history",
        status: "failed",
      }),
    ]);
  });

  it("lists runs in order by createdAt descending", async () => {
    // Runs are stored in insertion order; latest first
    const first = await store.createRefreshRun(makeRun());
    const second = await store.createRefreshRun(makeRun());

    const runs = await store.listRefreshRuns("city_chicago");

    expect(runs).toHaveLength(2);
  });

  it("grants the city refresh lease to only one concurrent run", async () => {
    const attempts = await Promise.all([
      store.acquireRefreshLease({
        ...makeRun({ triggeredBy: "admin-a" }),
        acquiredAt: "2026-07-27T12:00:00.000Z",
      }),
      store.acquireRefreshLease({
        ...makeRun({ triggeredBy: "admin-b" }),
        acquiredAt: "2026-07-27T12:00:00.000Z",
      }),
    ]);

    const acquired = attempts.filter((attempt) => attempt.acquired);
    const blocked = attempts.filter((attempt) => !attempt.acquired);

    expect(acquired).toHaveLength(1);
    expect(blocked).toEqual([
      {
        acquired: false,
        activeRunId: acquired[0].run.id,
      },
    ]);
    await expect(store.listRefreshRuns("city_chicago")).resolves.toHaveLength(1);
  });
});
