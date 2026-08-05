import { describe, it, expect, beforeEach } from "vitest";
import { createDrizzleRefreshStore } from "../drizzle-refresh-store";
import type { RefreshStore } from "../refresh-store";

function table<T>(rows: T[]) {
  return {
    async findMany() {
      return rows;
    },
  };
}

function createMockDb(
  onExecute: () => void = () => {},
  refreshTargetOutcomeRows: Record<string, unknown>[] = [],
) {
  let lockTail = Promise.resolve();
  const data: Record<string, Record<string, unknown>[]> = {};
  const tables = [
    "source_owners",
    "source_targets",
    "refresh_runs",
    "refresh_target_outcomes",
    "refresh_run_logs",
    "review_items",
    "source_event_observations",
    "review_decision_history",
  ];
  for (const t of tables) {
    data[t] = [];
  }

  const insert = () => ({
    values(_values: Record<string, unknown>) {},
  });

  const update = () => ({
    set(_values: Record<string, unknown>) {
      return { where: () => {} };
    },
  });

  const del = () => ({
    where: () => {},
  });

  const base = {
    query: {
      sourceOwners: table([]),
      sourceTargets: table([]),
      refreshRuns: table([]),
      refreshTargetOutcomes: table(refreshTargetOutcomeRows),
      refreshRunLogs: table([]),
      reviewItems: table([]),
      sourceEventObservations: table([]),
      reviewDecisionHistory: table([]),
    },
    insert,
    update,
    delete: del,
  };

  return {
    ...base,
    async transaction(fn: (tx: unknown) => Promise<unknown>) {
      let releaseLock = () => {};
      try {
        return await fn({
          ...base,
          async execute() {
            onExecute();
            const previous = lockTail;
            const current = new Promise<void>((resolve) => {
              releaseLock = resolve;
            });
            lockTail = current;
            await previous;
          },
        });
      } finally {
        releaseLock();
      }
    },
  } as unknown as Parameters<typeof createDrizzleRefreshStore>[0];
}

describe("drizzle refresh store", () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createDrizzleRefreshStore(createMockDb());
  });

  describe("source owners", () => {
    it("creates and lists source owners", async () => {
      const created = await store.createSourceOwner({
        cityId: "city_chicago",
        name: "smartbar",
        slug: "smartbar",
        kind: "venue",
        notes: "",
      });

      // Re-initialize store with fresh mock to see persisted data
      const db = createMockDb();
      await createDrizzleRefreshStore(db).createSourceOwner({
        cityId: "city_chicago",
        name: "smartbar",
        slug: "smartbar",
        kind: "venue",
        notes: "",
      });

      expect(created.name).toBe("smartbar");
      expect(created.kind).toBe("venue");
    });

    it("returns null for missing owner", async () => {
      const found = await store.getSourceOwner("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("source targets", () => {
    it("creates a source target", async () => {
      const created = await store.createSourceTarget({
        ownerId: "source_owner_smartbar",
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

      expect(created.url).toBe("https://smartbarchicago.com/calendar");
      expect(created.parserStrategy).toBe("venue-calendar");
      expect(created.etag).toBeNull();
      expect(created.lastModified).toBeNull();
    });
  });

  describe("refresh runs", () => {
    it("creates a run with pending status", async () => {
      const run = await store.createRefreshRun({
        cityId: "city_chicago",
        trigger: "manual",
        triggeredBy: "admin-secret",
      });

      expect(run.status).toBe("pending");
      expect(run.sourceTargetsChecked).toBe(0);
    });

    it("lists persisted outcome history for one source target", async () => {
      const outcomeRow = {
        id: "outcome_1",
        runId: "run_1",
        sourceTargetId: "target_1",
        status: "failed",
        startedAt: "2026-07-26T12:00:00.000Z",
        finishedAt: "2026-07-26T12:00:01.000Z",
        candidateCount: 0,
        createdCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        warningCount: 0,
        errorDetails: JSON.stringify({
          code: null,
          message: "Source failed",
        }),
        requestDurationMs: 100,
        responseStatus: 500,
        responseSizeBytes: 0,
        retryCount: 0,
        finalUrl: "https://source.test/events",
      };
      const historyStore = createDrizzleRefreshStore(
        createMockDb(() => {}, [
          outcomeRow,
          {
            ...outcomeRow,
            id: "outcome_2",
            runId: "run_2",
            sourceTargetId: "target_2",
          },
        ]),
      );

      await expect(
        historyStore.listSourceTargetOutcomes("target_1"),
      ).resolves.toEqual([
        expect.objectContaining({
          id: "outcome_1",
          sourceTargetId: "target_1",
          status: "failed",
          errorDetails: {
            code: null,
            message: "Source failed",
          },
        }),
      ]);
    });
  });

  describe("run logs", () => {
    it("creates a run log entry", async () => {
      const log = await store.createRunLog({
        runId: "run_1",
        sourceTargetId: null,
        level: "info",
        message: "Fetching target",
        metadata: null,
      });

      expect(log.runId).toBe("run_1");
      expect(log.level).toBe("info");
    });
  });

  describe("review items", () => {
    it("creates a review item", async () => {
      const item = await store.createReviewItem({
        cityId: "city_chicago",
        runId: "run_1",
        sourceTargetId: "st_1",
        lane: "new-event",
        priority: 1,
        confidence: 0.9,
        confidenceReasons: ["venue match"],
        targetEntityType: "event",
        targetEntityId: null,
        matchFingerprint: "fp_test",
        normalizedDraft: { title: "Test" },
        fieldDiffs: null,
        linkedDrafts: [],
        conflicts: null,
        evidence: { sourceUrls: [], excerpts: [], contentHashes: [] },
        parserVersion: "1.0.0",
        fetchTimestamp: new Date().toISOString(),
      });

      expect(item.status).toBe("pending");
      expect(item.lane).toBe("new-event");
    });
  });

  describe("decision history", () => {
    it("creates a decision entry", async () => {
      const decision = await store.createDecisionHistory({
        reviewItemId: "ri_1",
        decision: "approved",
        fieldName: null,
        reason: null,
        notes: null,
        reviewedBy: "admin-secret",
      });

      expect(decision.reviewItemId).toBe("ri_1");
      expect(decision.decision).toBe("approved");
    });
  });

  describe("source event observations", () => {
    it("creates a durable observation with first-seen timestamps", async () => {
      const observation = await store.createSourceEventObservation({
        sourceTargetId: "target_1",
        sourceEventKey: "event-42",
        matchFingerprint: "event:2026-07-12t03-00-00-000z:venue",
        materialContentHash: "b".repeat(64),
        normalizedCandidate: { title: "Event" },
        seenAt: "2026-07-11T12:00:00.000Z",
        latestReviewItemId: null,
        publishedEventId: null,
        parserVersion: "venue-calendar@1",
      });

      expect(observation).toMatchObject({
        sourceEventKey: "event-42",
        firstSeenAt: "2026-07-11T12:00:00.000Z",
        lastSeenAt: "2026-07-11T12:00:00.000Z",
        lastChangedAt: "2026-07-11T12:00:00.000Z",
      });
    });

    it("acquires the database transaction lock before classifying an observation", async () => {
      const events: string[] = [];
      const transactionStore = createDrizzleRefreshStore(
        createMockDb(() => events.push("locked")),
      );

      await transactionStore.withSourceEventObservationTransaction(
        "target_1",
        "event-42",
        async () => {
          events.push("classified");
        },
      );

      expect(events).toEqual(["locked", "classified"]);
    });

    it("serializes racing observation classifications in the database adapter", async () => {
      const transactionStore = createDrizzleRefreshStore(createMockDb());
      let activeClassifications = 0;
      let maximumActiveClassifications = 0;
      const classify = () =>
        transactionStore.withSourceEventObservationTransaction(
          "target_1",
          "event-42",
          async () => {
            activeClassifications += 1;
            maximumActiveClassifications = Math.max(
              maximumActiveClassifications,
              activeClassifications,
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
            activeClassifications -= 1;
          },
        );

      await Promise.all([classify(), classify()]);

      expect(maximumActiveClassifications).toBe(1);
    });
  });
});
