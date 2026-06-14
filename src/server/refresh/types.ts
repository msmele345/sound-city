// ─── Source Owner ────────────────────────────────────────────────

export type SourceOwnerRecord = {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  kind: "listing-platform" | "venue" | "artist" | "promoter" | "ticketing";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSourceOwnerInput = Omit<
  SourceOwnerRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateSourceOwnerInput = Partial<
  Pick<SourceOwnerRecord, "name" | "kind" | "notes">
>;

// ─── Source Target ────────────────────────────────────────────────

export type SourceType =
  | "resident-advisor"
  | "official-venue-calendar"
  | "artist-social"
  | "ticketing"
  | "other";

export type ParserStrategy =
  | "venue-calendar"
  | "artist-social"
  | "resident-advisor"
  | "dev-static";

export type TrustLevel = "primary" | "supporting" | "experimental";

export type HealthStatus = "healthy" | "degraded" | "failing" | "disabled";

export type SourceTargetRecord = {
  id: string;
  ownerId: string;
  cityId: string;
  url: string;
  sourceType: SourceType;
  parserStrategy: ParserStrategy;
  trustLevel: TrustLevel;
  enabled: boolean;
  confidenceAdjustment: number;
  healthStatus: HealthStatus;
  failureCount: number;
  rejectionCount: number;
  duplicateCount: number;
  refreshCadence: string;
  lastFetchedAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSourceTargetInput = Omit<
  SourceTargetRecord,
  | "id"
  | "failureCount"
  | "rejectionCount"
  | "duplicateCount"
  | "lastFetchedAt"
  | "lastSuccessfulRunAt"
  | "lastFailureAt"
  | "lastFailureReason"
  | "createdAt"
  | "updatedAt"
>;

export type UpdateSourceTargetInput = Partial<
  Pick<
    SourceTargetRecord,
    | "url"
    | "sourceType"
    | "parserStrategy"
    | "trustLevel"
    | "enabled"
    | "confidenceAdjustment"
    | "healthStatus"
    | "refreshCadence"
    | "notes"
    | "lastFetchedAt"
    | "lastSuccessfulRunAt"
    | "lastFailureAt"
    | "lastFailureReason"
  >
>;

export type SourceTargetCounterDelta = Partial<
  Pick<SourceTargetRecord, "failureCount" | "rejectionCount" | "duplicateCount">
>;

// ─── Refresh Run ──────────────────────────────────────────────────

export type RunTrigger = "manual" | "scheduled";
export type RunStatus = "pending" | "running" | "succeeded" | "failed" | "partial";

export type RefreshRunRecord = {
  id: string;
  cityId: string;
  trigger: RunTrigger;
  status: RunStatus;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  sourceTargetsChecked: number;
  sourceTargetsFailed: number;
  draftsCreated: number;
  updatesProposed: number;
  duplicatesFlagged: number;
  staleTasksCreated: number;
  errorSummary: string | null;
  createdAt: string;
};

export type CreateRefreshRunInput = {
  cityId: string;
  trigger: RunTrigger;
  triggeredBy: string;
};

// ─── Refresh Run Log ──────────────────────────────────────────────

export type RunLogLevel = "info" | "warning" | "error";

export type RefreshRunLogRecord = {
  id: string;
  runId: string;
  sourceTargetId: string | null;
  level: RunLogLevel;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Review Item ──────────────────────────────────────────────────

export type ReviewLane =
  | "new-event"
  | "proposed-update"
  | "possible-duplicate"
  | "stale-task"
  | "source-health";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type TargetEntityType = "event" | "venue" | "artist" | "source-target";

export type ReviewItemRecord = {
  id: string;
  cityId: string;
  runId: string;
  sourceTargetId: string | null;
  lane: ReviewLane;
  status: ReviewStatus;
  priority: number;
  confidence: number;
  confidenceReasons: string[];
  targetEntityType: TargetEntityType;
  targetEntityId: string | null;
  matchFingerprint: string;
  normalizedDraft: Record<string, unknown>;
  fieldDiffs: Record<string, unknown> | null;
  linkedDrafts: Record<string, unknown>[];
  conflicts: Record<string, unknown> | null;
  evidence: {
    sourceUrls: string[];
    excerpts: string[];
    contentHashes: string[];
  };
  parserVersion: string;
  fetchTimestamp: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewNotes: string | null;
  publishedEntityId: string | null;
  publishedSourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReviewItemInput = Omit<
  ReviewItemRecord,
  | "id"
  | "status"
  | "reviewedBy"
  | "reviewedAt"
  | "rejectionReason"
  | "reviewNotes"
  | "publishedEntityId"
  | "publishedSourceId"
  | "createdAt"
  | "updatedAt"
>;

export type UpdateReviewItemInput = Partial<
  Pick<
    ReviewItemRecord,
    | "status"
    | "priority"
    | "confidence"
    | "confidenceReasons"
    | "normalizedDraft"
    | "fieldDiffs"
    | "linkedDrafts"
    | "conflicts"
    | "evidence"
    | "reviewedBy"
    | "reviewedAt"
    | "rejectionReason"
    | "reviewNotes"
    | "publishedEntityId"
    | "publishedSourceId"
  >
>;

// ─── Review Decision History ──────────────────────────────────────

export type DecisionType =
  | "approved"
  | "rejected"
  | "edited"
  | "field-accepted"
  | "field-rejected";

export type ReviewDecisionRecord = {
  id: string;
  reviewItemId: string;
  decision: DecisionType;
  fieldName: string | null;
  reason: string | null;
  notes: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

// ─── Refresh Snapshot (for in-memory store) ───────────────────────

export type RefreshSnapshot = {
  sourceOwners: SourceOwnerRecord[];
  sourceTargets: SourceTargetRecord[];
  refreshRuns: RefreshRunRecord[];
  runLogs: RefreshRunLogRecord[];
  reviewItems: ReviewItemRecord[];
  decisionHistory: ReviewDecisionRecord[];
};
