import type { RefreshStore } from "./refresh-store";
import type { RefreshSnapshot } from "./types";

function cloneSnapshot(snapshot: RefreshSnapshot): RefreshSnapshot {
  return structuredClone(snapshot);
}

const emptySnapshot: RefreshSnapshot = {
  sourceOwners: [],
  sourceTargets: [],
  refreshRuns: [],
  refreshTargetOutcomes: [],
  runLogs: [],
  reviewItems: [],
  sourceEventObservations: [],
  decisionHistory: [],
};

function makeId(prefix: string, slug: string): string {
  return `${prefix}_${slug.replaceAll("-", "_")}`;
}

function now(): string {
  return new Date().toISOString();
}

export function createSeedRefreshStore(
  initialSnapshot?: RefreshSnapshot,
): RefreshStore {
  const snapshot = cloneSnapshot(initialSnapshot ?? emptySnapshot);
  let observationTransactionTail = Promise.resolve();

  const store: RefreshStore = {
    // ── Source Owners ──────────────────────────────────────────
    async listSourceOwners(cityId) {
      return snapshot.sourceOwners.filter((o) => o.cityId === cityId);
    },

    async getSourceOwner(id) {
      return snapshot.sourceOwners.find((o) => o.id === id) ?? null;
    },

    async createSourceOwner(input) {
      const id = makeId("source_owner", input.slug);
      const timestamp = now();
      const owner = { ...input, id, createdAt: timestamp, updatedAt: timestamp };
      snapshot.sourceOwners.push(owner);
      return owner;
    },

    async updateSourceOwner(id, input) {
      const index = snapshot.sourceOwners.findIndex((o) => o.id === id);
      if (index === -1) throw new Error("Source owner not found");
      const updated = { ...snapshot.sourceOwners[index], ...input, updatedAt: now() };
      snapshot.sourceOwners[index] = updated;
      return updated;
    },

    async deleteSourceOwner(id) {
      const index = snapshot.sourceOwners.findIndex((o) => o.id === id);
      if (index === -1) throw new Error("Source owner not found");
      snapshot.sourceOwners.splice(index, 1);
    },

    // ── Source Targets ─────────────────────────────────────────
    async listSourceTargets(cityId) {
      return snapshot.sourceTargets.filter((t) => t.cityId === cityId);
    },

    async getSourceTarget(id) {
      return snapshot.sourceTargets.find((t) => t.id === id) ?? null;
    },

    async createSourceTarget(input) {
      const id = makeId("source_target", `${input.ownerId}_${input.url.slice(0, 40)}`);
      const timestamp = now();
      const target = {
        ...input,
        id,
        failureCount: 0,
        rejectionCount: 0,
        duplicateCount: 0,
        lastFetchedAt: null,
        lastSuccessfulRunAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      snapshot.sourceTargets.push(target);
      return target;
    },

    async updateSourceTarget(id, input) {
      const index = snapshot.sourceTargets.findIndex((t) => t.id === id);
      if (index === -1) throw new Error("Source target not found");
      const updated = { ...snapshot.sourceTargets[index], ...input, updatedAt: now() };
      snapshot.sourceTargets[index] = updated;
      return updated;
    },

    async deleteSourceTarget(id) {
      const index = snapshot.sourceTargets.findIndex((t) => t.id === id);
      if (index === -1) throw new Error("Source target not found");
      snapshot.sourceTargets.splice(index, 1);
    },

    async incrementSourceTargetCounters(id, delta) {
      const index = snapshot.sourceTargets.findIndex((t) => t.id === id);
      if (index === -1) throw new Error("Source target not found");
      const current = snapshot.sourceTargets[index];
      const updated = {
        ...current,
        failureCount: current.failureCount + (delta.failureCount ?? 0),
        rejectionCount: current.rejectionCount + (delta.rejectionCount ?? 0),
        duplicateCount: current.duplicateCount + (delta.duplicateCount ?? 0),
        updatedAt: now(),
      };
      snapshot.sourceTargets[index] = updated;
      return updated;
    },

    // ── Refresh Runs ───────────────────────────────────────────
    async listRefreshRuns(cityId) {
      return snapshot.refreshRuns
        .filter((r) => r.cityId === cityId)
        .toReversed(); // newest first
    },

    async getRefreshRun(id) {
      return snapshot.refreshRuns.find((r) => r.id === id) ?? null;
    },

    async createRefreshRun(input) {
      const id = makeId(
        "refresh_run",
        `${input.cityId}_${Date.now()}_${snapshot.refreshRuns.length}`,
      );
      const timestamp = now();
      const run = {
        ...input,
        id,
        status: "pending" as const,
        startedAt: null,
        finishedAt: null,
        sourceTargetsChecked: 0,
        sourceTargetsFailed: 0,
        draftsCreated: 0,
        updatesProposed: 0,
        duplicatesFlagged: 0,
        staleTasksCreated: 0,
        errorSummary: null,
        createdAt: timestamp,
      };
      snapshot.refreshRuns.push(run);
      return run;
    },

    async updateRefreshRun(id, updates) {
      const index = snapshot.refreshRuns.findIndex((r) => r.id === id);
      if (index === -1) throw new Error("Refresh run not found");
      const current = snapshot.refreshRuns[index];
      const updated = { ...current, ...updates };
      snapshot.refreshRuns[index] = updated;
      return updated;
    },

    // ── Refresh Target Outcomes ────────────────────────────────
    async listRefreshTargetOutcomes(runId) {
      return snapshot.refreshTargetOutcomes.filter(
        (outcome) => outcome.runId === runId,
      );
    },

    async listSourceTargetOutcomes(sourceTargetId) {
      return snapshot.refreshTargetOutcomes.filter(
        (outcome) => outcome.sourceTargetId === sourceTargetId,
      );
    },

    async createRefreshTargetOutcome(input) {
      const duplicate = snapshot.refreshTargetOutcomes.some(
        (outcome) =>
          outcome.runId === input.runId &&
          outcome.sourceTargetId === input.sourceTargetId,
      );
      if (duplicate) {
        throw new Error("Refresh target outcome already exists");
      }
      const outcome = {
        ...input,
        id: makeId(
          "refresh_target_outcome",
          `${input.runId}_${input.sourceTargetId}`,
        ),
        status: "running" as const,
        finishedAt: null,
        candidateCount: 0,
        createdCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        warningCount: 0,
        errorDetails: null,
        requestDurationMs: null,
        responseStatus: null,
        responseSizeBytes: null,
        retryCount: 0,
        finalUrl: null,
      };
      snapshot.refreshTargetOutcomes.push(outcome);
      return outcome;
    },

    async updateRefreshTargetOutcome(id, updates) {
      const index = snapshot.refreshTargetOutcomes.findIndex(
        (outcome) => outcome.id === id,
      );
      if (index === -1) throw new Error("Refresh target outcome not found");
      const updated = { ...snapshot.refreshTargetOutcomes[index], ...updates };
      snapshot.refreshTargetOutcomes[index] = updated;
      return updated;
    },

    // ── Run Logs ───────────────────────────────────────────────
    async listRunLogs(runId) {
      return snapshot.runLogs.filter((l) => l.runId === runId);
    },

    async createRunLog(input) {
      const id = makeId("run_log", `${input.runId}_${snapshot.runLogs.length}`);
      const log = { ...input, id, createdAt: now() };
      snapshot.runLogs.push(log);
      return log;
    },

    // ── Review Items ───────────────────────────────────────────
    async listReviewItems(cityId, lane) {
      let items = snapshot.reviewItems.filter((i) => i.cityId === cityId);
      if (lane) items = items.filter((i) => i.lane === lane);
      return items;
    },

    async getReviewItem(id) {
      return snapshot.reviewItems.find((i) => i.id === id) ?? null;
    },

    async createReviewItem(input) {
      const id = makeId("review_item", `${input.runId}_${snapshot.reviewItems.length}`);
      const timestamp = now();
      const item = {
        ...input,
        id,
        status: "pending" as const,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        reviewNotes: null,
        publishedEntityId: null,
        publishedSourceId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      snapshot.reviewItems.push(item);
      return item;
    },

    async updateReviewItem(id, input) {
      const index = snapshot.reviewItems.findIndex((i) => i.id === id);
      if (index === -1) throw new Error("Review item not found");
      const updated = { ...snapshot.reviewItems[index], ...input, updatedAt: now() };
      snapshot.reviewItems[index] = updated;
      return updated;
    },

    // ── Source Event Observations ──────────────────────────────
    async getSourceEventObservation(sourceTargetId, sourceEventKey) {
      return snapshot.sourceEventObservations.find(
        (observation) =>
          observation.sourceTargetId === sourceTargetId &&
          observation.sourceEventKey === sourceEventKey,
      ) ?? null;
    },

    async createSourceEventObservation(input) {
      const existing = snapshot.sourceEventObservations.some(
        (observation) =>
          observation.sourceTargetId === input.sourceTargetId &&
          observation.sourceEventKey === input.sourceEventKey,
      );
      if (existing) {
        throw new Error(
          "Source event observation already exists for this target and source event key",
        );
      }
      const id = makeId(
        "source_event_observation",
        `${input.sourceTargetId}_${input.sourceEventKey}`,
      );
      const observation = {
        id,
        sourceTargetId: input.sourceTargetId,
        sourceEventKey: input.sourceEventKey,
        matchFingerprint: input.matchFingerprint,
        materialContentHash: input.materialContentHash,
        normalizedCandidate: structuredClone(input.normalizedCandidate),
        firstSeenAt: input.seenAt,
        lastSeenAt: input.seenAt,
        lastChangedAt: input.seenAt,
        latestReviewItemId: input.latestReviewItemId,
        publishedEventId: input.publishedEventId,
        parserVersion: input.parserVersion,
      };
      snapshot.sourceEventObservations.push(observation);
      return observation;
    },

    async updateSourceEventObservation(id, input) {
      const index = snapshot.sourceEventObservations.findIndex(
        (observation) => observation.id === id,
      );
      if (index === -1) throw new Error("Source event observation not found");
      const updated = {
        ...snapshot.sourceEventObservations[index],
        ...input,
        normalizedCandidate: input.normalizedCandidate
          ? structuredClone(input.normalizedCandidate)
          : snapshot.sourceEventObservations[index].normalizedCandidate,
      };
      snapshot.sourceEventObservations[index] = updated;
      return updated;
    },

    async withSourceEventObservationTransaction(
      _sourceTargetId,
      _sourceEventKey,
      fn,
    ) {
      const previous = observationTransactionTail;
      let release = () => {};
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      observationTransactionTail = current;
      await previous;

      const before = cloneSnapshot(snapshot);
      try {
        return await fn(store);
      } catch (error) {
        Object.assign(snapshot, before);
        throw error;
      } finally {
        release();
        if (observationTransactionTail === current) {
          observationTransactionTail = Promise.resolve();
        }
      }
    },

    // ── Decision History ────────────────────────────────────────
    async listDecisionHistory(reviewItemId) {
      return snapshot.decisionHistory.filter((d) => d.reviewItemId === reviewItemId);
    },

    async createDecisionHistory(input) {
      const id = makeId("decision", `${input.reviewItemId}_${snapshot.decisionHistory.length}`);
      const decision = { ...input, id, createdAt: now() };
      snapshot.decisionHistory.push(decision);
      return decision;
    },

    // ── Transaction ────────────────────────────────────────────
    async withTransaction(fn) {
      // Best-effort: seed store mutations are not rollback-safe.
      // If the callback throws, prior mutations persist in the snapshot.
      return fn(this);
    },
  };

  return store;
}
