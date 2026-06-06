import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { RefreshRunLogRecord, CreateRefreshRunInput } from "../types";

async function setupRun(store: RefreshStore): Promise<string> {
  const run = await store.createRefreshRun({
    cityId: "city_chicago",
    trigger: "manual",
    triggeredBy: "admin-secret",
  });
  return run.id;
}

function makeLog(
  overrides: Partial<Omit<RefreshRunLogRecord, "id" | "createdAt">> & { runId: string },
): Omit<RefreshRunLogRecord, "id" | "createdAt"> {
  return {
    runId: overrides.runId,
    sourceTargetId: overrides.sourceTargetId ?? null,
    level: overrides.level ?? "info",
    message: overrides.message ?? "Fetching source target",
    metadata: overrides.metadata ?? null,
  };
}

describe("run log store", () => {
  let store: RefreshStore;

  beforeEach(async () => {
    store = createSeedRefreshStore();
  });

  it("creates a run log entry", async () => {
    const runId = await setupRun(store);

    const log = await store.createRunLog(makeLog({ runId }));

    expect(log.id).toBeDefined();
    expect(log.runId).toBe(runId);
    expect(log.level).toBe("info");
    expect(log.createdAt).toBeDefined();
  });

  it("lists run logs for a run", async () => {
    const runId = await setupRun(store);
    await store.createRunLog(makeLog({ runId, message: "First" }));
    await store.createRunLog(makeLog({ runId, message: "Second", level: "warning" }));

    const logs = await store.listRunLogs(runId);

    expect(logs).toHaveLength(2);
    expect(logs[1].message).toBe("Second");
  });

  it("logs can have warning and error levels", async () => {
    const runId = await setupRun(store);
    await store.createRunLog(makeLog({ runId, level: "warning", message: "Slow response" }));
    await store.createRunLog(makeLog({ runId, level: "error", message: "Connection failed" }));

    const logs = await store.listRunLogs(runId);

    expect(logs[0].level).toBe("warning");
    expect(logs[1].level).toBe("error");
  });

  it("stores metadata as JSON", async () => {
    const runId = await setupRun(store);

    const log = await store.createRunLog(
      makeLog({
        runId,
        level: "error",
        message: "Parse failure",
        metadata: { parserError: "Invalid ICS", line: 42 },
      }),
    );

    expect(log.metadata).toEqual({ parserError: "Invalid ICS", line: 42 });
  });

  it("returns empty list for run with no logs", async () => {
    const runId = await setupRun(store);

    const logs = await store.listRunLogs(runId);

    expect(logs).toHaveLength(0);
  });

  it("attaches source target id to log entries", async () => {
    const runId = await setupRun(store);

    const log = await store.createRunLog(
      makeLog({ runId, sourceTargetId: "st_001", message: "Target specific log" }),
    );

    expect(log.sourceTargetId).toBe("st_001");
  });
});
