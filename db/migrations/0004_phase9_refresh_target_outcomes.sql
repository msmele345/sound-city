CREATE TABLE "refresh_target_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_target_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"error_details" text,
	"request_duration_ms" integer,
	"response_status" integer,
	"response_size_bytes" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"final_url" text
);
--> statement-breakpoint
ALTER TABLE "refresh_target_outcomes" ADD CONSTRAINT "refresh_target_outcomes_run_id_refresh_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."refresh_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_target_outcomes" ADD CONSTRAINT "refresh_target_outcomes_source_target_id_source_targets_id_fk" FOREIGN KEY ("source_target_id") REFERENCES "public"."source_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_target_outcomes_run_target_unique" ON "refresh_target_outcomes" USING btree ("run_id","source_target_id");
