import { createDb } from "../db/client";
import { createDrizzleRefreshStore } from "./drizzle-refresh-store";
import { createSeedRefreshStore } from "./store";
import type {
  CreateRefreshRunInput,
  CreateReviewItemInput,
  CreateSourceOwnerInput,
  CreateSourceTargetInput,
  RefreshRunLogRecord,
  RefreshRunRecord,
  ReviewDecisionRecord,
  ReviewItemRecord,
  ReviewLane,
  SourceOwnerRecord,
  SourceTargetRecord,
  UpdateReviewItemInput,
  UpdateSourceOwnerInput,
  UpdateSourceTargetInput,
} from "./types";

export type RefreshStore = {
  // ── Source Owners ────────────────────────────────────────────
  listSourceOwners(cityId: string): Promise<SourceOwnerRecord[]>;
  getSourceOwner(id: string): Promise<SourceOwnerRecord | null>;
  createSourceOwner(input: CreateSourceOwnerInput): Promise<SourceOwnerRecord>;
  updateSourceOwner(
    id: string,
    input: UpdateSourceOwnerInput,
  ): Promise<SourceOwnerRecord>;
  deleteSourceOwner(id: string): Promise<void>;

  // ── Source Targets ───────────────────────────────────────────
  listSourceTargets(cityId: string): Promise<SourceTargetRecord[]>;
  getSourceTarget(id: string): Promise<SourceTargetRecord | null>;
  createSourceTarget(
    input: CreateSourceTargetInput,
  ): Promise<SourceTargetRecord>;
  updateSourceTarget(
    id: string,
    input: UpdateSourceTargetInput,
  ): Promise<SourceTargetRecord>;
  deleteSourceTarget(id: string): Promise<void>;

  // ── Refresh Runs ─────────────────────────────────────────────
  listRefreshRuns(cityId: string): Promise<RefreshRunRecord[]>;
  getRefreshRun(id: string): Promise<RefreshRunRecord | null>;
  createRefreshRun(input: CreateRefreshRunInput): Promise<RefreshRunRecord>;
  updateRefreshRun(
    id: string,
    updates: Partial<RefreshRunRecord>,
  ): Promise<RefreshRunRecord>;

  // ── Run Logs ─────────────────────────────────────────────────
  listRunLogs(runId: string): Promise<RefreshRunLogRecord[]>;
  createRunLog(log: Omit<RefreshRunLogRecord, "id" | "createdAt">): Promise<RefreshRunLogRecord>;

  // ── Review Items ─────────────────────────────────────────────
  listReviewItems(
    cityId: string,
    lane?: ReviewLane,
  ): Promise<ReviewItemRecord[]>;
  getReviewItem(id: string): Promise<ReviewItemRecord | null>;
  createReviewItem(input: CreateReviewItemInput): Promise<ReviewItemRecord>;
  updateReviewItem(
    id: string,
    input: UpdateReviewItemInput,
  ): Promise<ReviewItemRecord>;

  // ── Decision History ─────────────────────────────────────────
  listDecisionHistory(reviewItemId: string): Promise<ReviewDecisionRecord[]>;
  createDecisionHistory(
    decision: Omit<ReviewDecisionRecord, "id" | "createdAt">,
  ): Promise<ReviewDecisionRecord>;
};

let fallbackStore: RefreshStore | null = null;
let databaseStore: RefreshStore | null = null;

/**
 * Returns the Drizzle-backed refresh store when `DATABASE_URL` is set and an
 * in-memory seed store otherwise, mirroring `getCatalogStore`. The seed store
 * keeps refresh admin usable in local dev and tests without a database.
 */
export function getRefreshStore(): RefreshStore {
  if (process.env.DATABASE_URL) {
    databaseStore ??= createDrizzleRefreshStore(createDb());
    return databaseStore;
  }

  fallbackStore ??= createSeedRefreshStore();
  return fallbackStore;
}
