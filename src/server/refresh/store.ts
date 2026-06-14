import type { RefreshStore } from "./refresh-store";
import type { RefreshSnapshot } from "./types";

function cloneSnapshot(snapshot: RefreshSnapshot): RefreshSnapshot {
  return structuredClone(snapshot);
}

const emptySnapshot: RefreshSnapshot = {
  sourceOwners: [],
  sourceTargets: [],
  refreshRuns: [],
  runLogs: [],
  reviewItems: [],
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

  return {
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
      const id = makeId("refresh_run", `${input.cityId}_${Date.now()}`);
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
}
