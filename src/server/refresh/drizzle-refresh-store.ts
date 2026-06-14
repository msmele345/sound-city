import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { RefreshStore } from "./refresh-store";
import type {
  RefreshRunLogRecord,
  RefreshRunRecord,
  ReviewDecisionRecord,
  ReviewItemRecord,
  SourceOwnerRecord,
  SourceTargetRecord,
} from "./types";
import type { createDb } from "../db/client";
import * as schema from "../db/schema";

// ── Row types (from Drizzle) ──────────────────────────────────────

type FindManyTable<Row> = {
  findMany(): Promise<Row[]>;
};

type SourceOwnerRow = {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  kind: string;
  notes: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SourceTargetRow = {
  id: string;
  ownerId: string;
  cityId: string;
  url: string;
  sourceType: string;
  parserStrategy: string;
  trustLevel: string;
  enabled: boolean;
  confidenceAdjustment: number;
  healthStatus: string;
  refreshCadence: string;
  lastFetchedAt: string | Date | null;
  lastSuccessfulRunAt: string | Date | null;
  lastFailureAt: string | Date | null;
  lastFailureReason: string | null;
  notes: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type RefreshRunRow = {
  id: string;
  cityId: string;
  trigger: string;
  status: string;
  triggeredBy: string;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
  sourceTargetsChecked: number;
  sourceTargetsFailed: number;
  draftsCreated: number;
  updatesProposed: number;
  duplicatesFlagged: number;
  staleTasksCreated: number;
  errorSummary: string | null;
  createdAt: string | Date;
};

type RefreshRunLogRow = {
  id: string;
  runId: string;
  sourceTargetId: string | null;
  level: string;
  message: string;
  metadata: string | null;
  createdAt: string | Date;
};

type ReviewItemRow = {
  id: string;
  cityId: string;
  runId: string;
  sourceTargetId: string;
  lane: string;
  status: string;
  priority: number;
  confidence: number;
  confidenceReasons: string[];
  targetEntityType: string;
  targetEntityId: string | null;
  matchFingerprint: string;
  normalizedDraft: string;
  fieldDiffs: string | null;
  linkedDrafts: string;
  conflicts: string | null;
  evidence: string;
  parserVersion: string;
  fetchTimestamp: string | Date;
  reviewedBy: string | null;
  reviewedAt: string | Date | null;
  rejectionReason: string | null;
  reviewNotes: string | null;
  publishedEntityId: string | null;
  publishedSourceId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ReviewDecisionRow = {
  id: string;
  reviewItemId: string;
  decision: string;
  fieldName: string | null;
  reason: string | null;
  notes: string | null;
  reviewedBy: string | null;
  createdAt: string | Date;
};

// ── DB type ────────────────────────────────────────────────────────

export type RefreshDbReader = {
  query: {
    sourceOwners: FindManyTable<SourceOwnerRow>;
    sourceTargets: FindManyTable<SourceTargetRow>;
    refreshRuns: FindManyTable<RefreshRunRow>;
    refreshRunLogs: FindManyTable<RefreshRunLogRow>;
    reviewItems: FindManyTable<ReviewItemRow>;
    reviewDecisionHistory: FindManyTable<ReviewDecisionRow>;
  };
};

type RefreshDbWriter = Pick<
  ReturnType<typeof createDb>,
  "delete" | "insert" | "update" | "transaction"
>;

type RefreshDb = RefreshDbReader & Partial<RefreshDbWriter>;

// ── Helpers ────────────────────────────────────────────────────────

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeDateOrNull(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) return null;
  return normalizeDate(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function parseJsonOrNull<T>(value: string | null | undefined): T | null {
  if (value == null) return null;
  return JSON.parse(value) as T;
}

function requireWriter(db: RefreshDb): RefreshDbWriter {
  if (!db.delete || !db.insert || !db.update) {
    throw new Error("Refresh write operations require a Drizzle database");
  }
  return db as RefreshDbWriter;
}

function uniqueId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

// ── Record mapping ─────────────────────────────────────────────────

function toSourceOwner(row: SourceOwnerRow): SourceOwnerRecord {
  return {
    ...row,
    kind: row.kind as SourceOwnerRecord["kind"],
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  };
}

function toSourceTarget(row: SourceTargetRow): SourceTargetRecord {
  return {
    ...row,
    sourceType: row.sourceType as SourceTargetRecord["sourceType"],
    parserStrategy: row.parserStrategy as SourceTargetRecord["parserStrategy"],
    trustLevel: row.trustLevel as SourceTargetRecord["trustLevel"],
    healthStatus: row.healthStatus as SourceTargetRecord["healthStatus"],
    lastFetchedAt: normalizeDateOrNull(row.lastFetchedAt),
    lastSuccessfulRunAt: normalizeDateOrNull(row.lastSuccessfulRunAt),
    lastFailureAt: normalizeDateOrNull(row.lastFailureAt),
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  };
}

function toRefreshRun(row: RefreshRunRow): RefreshRunRecord {
  return {
    ...row,
    trigger: row.trigger as RefreshRunRecord["trigger"],
    status: row.status as RefreshRunRecord["status"],
    startedAt: normalizeDateOrNull(row.startedAt),
    finishedAt: normalizeDateOrNull(row.finishedAt),
    createdAt: normalizeDate(row.createdAt),
  };
}

function toRunLog(row: RefreshRunLogRow): RefreshRunLogRecord {
  return {
    ...row,
    level: row.level as RefreshRunLogRecord["level"],
    metadata: parseJsonOrNull(row.metadata),
    createdAt: normalizeDate(row.createdAt),
  };
}

function toReviewItem(row: ReviewItemRow): ReviewItemRecord {
  return {
    ...row,
    lane: row.lane as ReviewItemRecord["lane"],
    status: row.status as ReviewItemRecord["status"],
    targetEntityType: row.targetEntityType as ReviewItemRecord["targetEntityType"],
    normalizedDraft: parseJson(row.normalizedDraft),
    fieldDiffs: parseJsonOrNull(row.fieldDiffs),
    linkedDrafts: parseJson(row.linkedDrafts),
    conflicts: parseJsonOrNull(row.conflicts),
    evidence: parseJson(row.evidence),
    fetchTimestamp: normalizeDate(row.fetchTimestamp),
    reviewedAt: normalizeDateOrNull(row.reviewedAt),
    createdAt: normalizeDate(row.createdAt),
    updatedAt: normalizeDate(row.updatedAt),
  };
}

function toDecisionHistory(row: ReviewDecisionRow): ReviewDecisionRecord {
  return {
    ...row,
    decision: row.decision as ReviewDecisionRecord["decision"],
    createdAt: normalizeDate(row.createdAt),
  };
}

// ── Factory ─────────────────────────────────────────────────────────

export function createDrizzleRefreshStore(db: RefreshDb): RefreshStore {
  return {
    // ── Source Owners ──────────────────────────────────────────
    async listSourceOwners(cityId) {
      const city = await db.query.sourceOwners.findMany();
      return city
        .filter((row) => row.cityId === cityId)
        .map(toSourceOwner);
    },

    async getSourceOwner(id) {
      const rows = await db.query.sourceOwners.findMany();
      const row = rows.find((r) => r.id === id);
      return row ? toSourceOwner(row) : null;
    },

    async createSourceOwner(input) {
      const writer = requireWriter(db);
      const id = `source_owner_${input.slug.replaceAll("-", "_")}`;
      const now = new Date().toISOString();
      await writer.insert(schema.sourceOwners).values({
        id,
        cityId: input.cityId,
        name: input.name,
        slug: input.slug,
        kind: input.kind,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      });
      return { ...input, id, createdAt: now, updatedAt: now };
    },

    async updateSourceOwner(id, input) {
      const writer = requireWriter(db);
      const now = new Date().toISOString();
      await writer
        .update(schema.sourceOwners)
        .set({ ...input, updatedAt: now })
        .where(eq(schema.sourceOwners.id, id));
      const owners = await db.query.sourceOwners.findMany();
      const row = owners.find((r) => r.id === id);
      if (!row) throw new Error("Source owner not found");
      return toSourceOwner(row);
    },

    async deleteSourceOwner(id) {
      const writer = requireWriter(db);
      await writer
        .delete(schema.sourceOwners)
        .where(eq(schema.sourceOwners.id, id));
    },

    // ── Source Targets ─────────────────────────────────────────
    async listSourceTargets(cityId) {
      const rows = await db.query.sourceTargets.findMany();
      return rows.filter((r) => r.cityId === cityId).map(toSourceTarget);
    },

    async getSourceTarget(id) {
      const rows = await db.query.sourceTargets.findMany();
      const row = rows.find((r) => r.id === id);
      return row ? toSourceTarget(row) : null;
    },

    async createSourceTarget(input) {
      const writer = requireWriter(db);
      const id = `source_target_${input.ownerId}_${input.url.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "_")}`;
      const now = new Date().toISOString();
      await writer.insert(schema.sourceTargets).values({
        id,
        ownerId: input.ownerId,
        cityId: input.cityId,
        url: input.url,
        sourceType: input.sourceType,
        parserStrategy: input.parserStrategy,
        trustLevel: input.trustLevel,
        enabled: input.enabled,
        confidenceAdjustment: input.confidenceAdjustment,
        healthStatus: input.healthStatus,
        refreshCadence: input.refreshCadence,
        lastFetchedAt: null,
        lastSuccessfulRunAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      });
      const record: SourceTargetRecord = {
        ...input,
        id,
        lastFetchedAt: null,
        lastSuccessfulRunAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        createdAt: now,
        updatedAt: now,
      };
      return record;
    },

    async updateSourceTarget(id, input) {
      const writer = requireWriter(db);
      const now = new Date().toISOString();
      await writer
        .update(schema.sourceTargets)
        .set({ ...input, updatedAt: now })
        .where(eq(schema.sourceTargets.id, id));
      const rows = await db.query.sourceTargets.findMany();
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Source target not found");
      return toSourceTarget(row);
    },

    async deleteSourceTarget(id) {
      const writer = requireWriter(db);
      await writer
        .delete(schema.sourceTargets)
        .where(eq(schema.sourceTargets.id, id));
    },

    // ── Refresh Runs ───────────────────────────────────────────
    async listRefreshRuns(cityId) {
      const rows = await db.query.refreshRuns.findMany();
      return rows
        .filter((r) => r.cityId === cityId)
        .map(toRefreshRun)
        .toReversed();
    },

    async getRefreshRun(id) {
      const rows = await db.query.refreshRuns.findMany();
      const row = rows.find((r) => r.id === id);
      return row ? toRefreshRun(row) : null;
    },

    async createRefreshRun(input) {
      const writer = requireWriter(db);
      const id = uniqueId(`refresh_run_${input.cityId}`);
      const now = new Date().toISOString();
      await writer.insert(schema.refreshRuns).values({
        id,
        cityId: input.cityId,
        trigger: input.trigger,
        status: "pending",
        triggeredBy: input.triggeredBy,
        startedAt: null,
        finishedAt: null,
        sourceTargetsChecked: 0,
        sourceTargetsFailed: 0,
        draftsCreated: 0,
        updatesProposed: 0,
        duplicatesFlagged: 0,
        staleTasksCreated: 0,
        errorSummary: null,
        createdAt: now,
      });
      return {
        ...input,
        id,
        status: "pending",
        startedAt: null,
        finishedAt: null,
        sourceTargetsChecked: 0,
        sourceTargetsFailed: 0,
        draftsCreated: 0,
        updatesProposed: 0,
        duplicatesFlagged: 0,
        staleTasksCreated: 0,
        errorSummary: null,
        createdAt: now,
      };
    },

    async updateRefreshRun(id, updates) {
      const writer = requireWriter(db);
      await writer
        .update(schema.refreshRuns)
        .set(updates)
        .where(eq(schema.refreshRuns.id, id));
      const rows = await db.query.refreshRuns.findMany();
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Refresh run not found");
      return toRefreshRun(row);
    },

    // ── Run Logs ───────────────────────────────────────────────
    async listRunLogs(runId) {
      const rows = await db.query.refreshRunLogs.findMany();
      return rows.filter((r) => r.runId === runId).map(toRunLog);
    },

    async createRunLog(input) {
      const writer = requireWriter(db);
      const id = uniqueId(`run_log_${input.runId}`);
      const now = new Date().toISOString();
      await writer.insert(schema.refreshRunLogs).values({
        id,
        runId: input.runId,
        sourceTargetId: input.sourceTargetId,
        level: input.level,
        message: input.message,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: now,
      });
      return { ...input, id, createdAt: now };
    },

    // ── Review Items ───────────────────────────────────────────
    async listReviewItems(cityId, lane) {
      const rows = await db.query.reviewItems.findMany();
      let filtered = rows.filter((r) => r.cityId === cityId);
      if (lane) filtered = filtered.filter((r) => r.lane === lane);
      return filtered.map(toReviewItem);
    },

    async getReviewItem(id) {
      const rows = await db.query.reviewItems.findMany();
      const row = rows.find((r) => r.id === id);
      return row ? toReviewItem(row) : null;
    },

    async createReviewItem(input) {
      const writer = requireWriter(db);
      const id = uniqueId(`review_item_${input.runId}`);
      const now = new Date().toISOString();
      await writer.insert(schema.reviewItems).values({
        id,
        cityId: input.cityId,
        runId: input.runId,
        sourceTargetId: input.sourceTargetId,
        lane: input.lane,
        status: "pending",
        priority: input.priority,
        confidence: input.confidence,
        confidenceReasons: input.confidenceReasons,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        matchFingerprint: input.matchFingerprint,
        normalizedDraft: JSON.stringify(input.normalizedDraft),
        fieldDiffs: input.fieldDiffs ? JSON.stringify(input.fieldDiffs) : null,
        linkedDrafts: JSON.stringify(input.linkedDrafts),
        conflicts: input.conflicts ? JSON.stringify(input.conflicts) : null,
        evidence: JSON.stringify(input.evidence),
        parserVersion: input.parserVersion,
        fetchTimestamp: input.fetchTimestamp,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        reviewNotes: null,
        publishedEntityId: null,
        publishedSourceId: null,
        createdAt: now,
        updatedAt: now,
      });
      return {
        ...input,
        id,
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        reviewNotes: null,
        publishedEntityId: null,
        publishedSourceId: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async updateReviewItem(id, input) {
      const writer = requireWriter(db);
      const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const [key, value] of Object.entries(input)) {
        if (
          ["normalizedDraft", "fieldDiffs", "linkedDrafts", "conflicts", "evidence"].includes(key) &&
          value != null
        ) {
          setValues[key] = JSON.stringify(value);
        } else {
          setValues[key] = value;
        }
      }
      await writer
        .update(schema.reviewItems)
        .set(setValues)
        .where(eq(schema.reviewItems.id, id));
      const rows = await db.query.reviewItems.findMany();
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Review item not found");
      return toReviewItem(row);
    },

    // ── Decision History ────────────────────────────────────────
    async listDecisionHistory(reviewItemId) {
      const rows = await db.query.reviewDecisionHistory.findMany();
      return rows.filter((r) => r.reviewItemId === reviewItemId).map(toDecisionHistory);
    },

    async createDecisionHistory(input) {
      const writer = requireWriter(db);
      const id = uniqueId(`decision_${input.reviewItemId}`);
      const now = new Date().toISOString();
      await writer.insert(schema.reviewDecisionHistory).values({
        id,
        reviewItemId: input.reviewItemId,
        decision: input.decision,
        fieldName: input.fieldName,
        reason: input.reason,
        notes: input.notes,
        reviewedBy: input.reviewedBy,
        createdAt: now,
      });
      return { ...input, id, createdAt: now };
    },

    // ── Transaction ────────────────────────────────────────────
    async withTransaction(fn) {
      const writer = requireWriter(db);
      return writer.transaction(async (tx) => {
        const txStore = createDrizzleRefreshStore(tx);
        return fn(txStore);
      });
    },
  };
}
