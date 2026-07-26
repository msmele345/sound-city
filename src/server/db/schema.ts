import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timeZone: text("time_zone").notNull(),
});

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { mode: "string" }).notNull(),
});

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  neighborhood: text("neighborhood").notNull(),
  address: text("address").notNull(),
  capacity: integer("capacity"),
});

export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio").notNull().default(""),
  styles: text("styles").array().notNull(),
  showcase: boolean("showcase").notNull().default(false),
});

export const artistLinks = pgTable("artist_links", {
  id: text("id").primaryKey(),
  artistId: text("artist_id")
    .notNull()
    .references(() => artists.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  venueId: text("venue_id")
    .notNull()
    .references(() => venues.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  startsAt: timestamp("starts_at", { mode: "string", withTimezone: true }).notNull(),
  styles: text("styles").array().notNull(),
});

export const eventArtists = pgTable(
  "event_artists",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.artistId] })],
);

export const venueSignals = pgTable("venue_signals", {
  id: text("id").primaryKey(),
  venueId: text("venue_id")
    .notNull()
    .references(() => venues.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  category: text("category").notNull(),
  value: text("value").notNull(),
});

// ─── V2 Refresh ──────────────────────────────────────────────────

export const sourceOwners = pgTable("source_owners", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  kind: text("kind").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const sourceTargets = pgTable("source_targets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => sourceOwners.id),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(),
  parserStrategy: text("parser_strategy").notNull(),
  trustLevel: text("trust_level").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  confidenceAdjustment: integer("confidence_adjustment").notNull().default(0),
  healthStatus: text("health_status").notNull().default("healthy"),
  failureCount: integer("failure_count").notNull().default(0),
  rejectionCount: integer("rejection_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  refreshCadence: text("refresh_cadence").notNull().default("daily"),
  lastFetchedAt: timestamp("last_fetched_at", { mode: "string" }),
  lastSuccessfulRunAt: timestamp("last_successful_run_at", { mode: "string" }),
  lastFailureAt: timestamp("last_failure_at", { mode: "string" }),
  lastFailureReason: text("last_failure_reason"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const refreshRuns = pgTable("refresh_runs", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  startedAt: timestamp("started_at", { mode: "string" }),
  finishedAt: timestamp("finished_at", { mode: "string" }),
  sourceTargetsChecked: integer("source_targets_checked").notNull().default(0),
  sourceTargetsFailed: integer("source_targets_failed").notNull().default(0),
  draftsCreated: integer("drafts_created").notNull().default(0),
  updatesProposed: integer("updates_proposed").notNull().default(0),
  duplicatesFlagged: integer("duplicates_flagged").notNull().default(0),
  staleTasksCreated: integer("stale_tasks_created").notNull().default(0),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const refreshTargetOutcomes = pgTable(
  "refresh_target_outcomes",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => refreshRuns.id),
    sourceTargetId: text("source_target_id")
      .notNull()
      .references(() => sourceTargets.id),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    finishedAt: timestamp("finished_at", { mode: "string" }),
    candidateCount: integer("candidate_count").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    unchangedCount: integer("unchanged_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    errorDetails: text("error_details"),
    requestDurationMs: integer("request_duration_ms"),
    responseStatus: integer("response_status"),
    responseSizeBytes: integer("response_size_bytes"),
    retryCount: integer("retry_count").notNull().default(0),
    finalUrl: text("final_url"),
  },
  (table) => [
    uniqueIndex("refresh_target_outcomes_run_target_unique").on(
      table.runId,
      table.sourceTargetId,
    ),
  ],
);

export const refreshRunLogs = pgTable("refresh_run_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => refreshRuns.id),
  sourceTargetId: text("source_target_id"),
  level: text("level").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const reviewItems = pgTable("review_items", {
  id: text("id").primaryKey(),
  cityId: text("city_id")
    .notNull()
    .references(() => cities.id),
  runId: text("run_id")
    .notNull()
    .references(() => refreshRuns.id),
  sourceTargetId: text("source_target_id").references(() => sourceTargets.id),
  lane: text("lane").notNull(),
  status: text("status").notNull(),
  priority: integer("priority").notNull().default(0),
  confidence: integer("confidence").notNull().default(0), // stored as 0-100 integer
  confidenceReasons: text("confidence_reasons").array().notNull(),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: text("target_entity_id"),
  matchFingerprint: text("match_fingerprint").notNull(),
  normalizedDraft: text("normalized_draft").notNull(), // JSON string
  fieldDiffs: text("field_diffs"), // JSON string
  linkedDrafts: text("linked_drafts").notNull().default("[]"), // JSON string
  conflicts: text("conflicts"), // JSON string
  evidence: text("evidence").notNull(), // JSON string
  parserVersion: text("parser_version").notNull(),
  fetchTimestamp: timestamp("fetch_timestamp", { mode: "string" }).notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { mode: "string" }),
  rejectionReason: text("rejection_reason"),
  reviewNotes: text("review_notes"),
  publishedEntityId: text("published_entity_id"),
  publishedSourceId: text("published_source_id"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const sourceEventObservations = pgTable(
  "source_event_observations",
  {
    id: text("id").primaryKey(),
    sourceTargetId: text("source_target_id")
      .notNull()
      .references(() => sourceTargets.id),
    sourceEventKey: text("source_event_key").notNull(),
    matchFingerprint: text("match_fingerprint").notNull(),
    materialContentHash: text("material_content_hash").notNull(),
    normalizedCandidate: text("normalized_candidate").notNull(),
    firstSeenAt: timestamp("first_seen_at", { mode: "string" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }).notNull(),
    lastChangedAt: timestamp("last_changed_at", { mode: "string" }).notNull(),
    latestReviewItemId: text("latest_review_item_id").references(
      () => reviewItems.id,
    ),
    publishedEventId: text("published_event_id").references(() => events.id),
    parserVersion: text("parser_version").notNull(),
  },
  (table) => [
    uniqueIndex("source_event_observations_target_event_key_unique").on(
      table.sourceTargetId,
      table.sourceEventKey,
    ),
  ],
);

export const reviewDecisionHistory = pgTable("review_decision_history", {
  id: text("id").primaryKey(),
  reviewItemId: text("review_item_id")
    .notNull()
    .references(() => reviewItems.id),
  decision: text("decision").notNull(),
  fieldName: text("field_name"),
  reason: text("reason"),
  notes: text("notes"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
