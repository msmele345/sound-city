CREATE TABLE "source_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"city_id" text NOT NULL,
	"url" text NOT NULL,
	"source_type" text NOT NULL,
	"parser_strategy" text NOT NULL,
	"trust_level" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"confidence_adjustment" integer DEFAULT 0 NOT NULL,
	"health_status" text DEFAULT 'healthy' NOT NULL,
	"refresh_cadence" text DEFAULT 'daily' NOT NULL,
	"last_fetched_at" timestamp,
	"last_successful_run_at" timestamp,
	"last_failure_at" timestamp,
	"last_failure_reason" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_owners" ADD CONSTRAINT "source_owners_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_targets" ADD CONSTRAINT "source_targets_owner_id_source_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."source_owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_targets" ADD CONSTRAINT "source_targets_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "refresh_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by" text NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"source_targets_checked" integer DEFAULT 0 NOT NULL,
	"source_targets_failed" integer DEFAULT 0 NOT NULL,
	"drafts_created" integer DEFAULT 0 NOT NULL,
	"updates_proposed" integer DEFAULT 0 NOT NULL,
	"duplicates_flagged" integer DEFAULT 0 NOT NULL,
	"stale_tasks_created" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_runs" ADD CONSTRAINT "refresh_runs_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "refresh_run_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_target_id" text,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"metadata" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_run_logs" ADD CONSTRAINT "refresh_run_logs_run_id_refresh_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."refresh_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"run_id" text NOT NULL,
	"source_target_id" text NOT NULL,
	"lane" text NOT NULL,
	"status" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"confidence_reasons" text[] NOT NULL,
	"target_entity_type" text NOT NULL,
	"target_entity_id" text,
	"match_fingerprint" text NOT NULL,
	"normalized_draft" text NOT NULL,
	"field_diffs" text,
	"linked_drafts" text DEFAULT '[]' NOT NULL,
	"conflicts" text,
	"evidence" text NOT NULL,
	"parser_version" text NOT NULL,
	"fetch_timestamp" timestamp NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"review_notes" text,
	"published_entity_id" text,
	"published_source_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_run_id_refresh_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."refresh_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_source_target_id_source_targets_id_fk" FOREIGN KEY ("source_target_id") REFERENCES "public"."source_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "review_decision_history" (
	"id" text PRIMARY KEY NOT NULL,
	"review_item_id" text NOT NULL,
	"decision" text NOT NULL,
	"field_name" text,
	"reason" text,
	"notes" text,
	"reviewed_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_decision_history" ADD CONSTRAINT "review_decision_history_review_item_id_review_items_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE no action ON UPDATE no action;
