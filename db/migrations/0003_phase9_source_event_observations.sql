CREATE TABLE "source_event_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_target_id" text NOT NULL,
	"source_event_key" text NOT NULL,
	"match_fingerprint" text NOT NULL,
	"material_content_hash" text NOT NULL,
	"normalized_candidate" text NOT NULL,
	"first_seen_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"last_changed_at" timestamp NOT NULL,
	"latest_review_item_id" text,
	"published_event_id" text,
	"parser_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_event_observations" ADD CONSTRAINT "source_event_observations_source_target_id_source_targets_id_fk" FOREIGN KEY ("source_target_id") REFERENCES "public"."source_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_event_observations" ADD CONSTRAINT "source_event_observations_latest_review_item_id_review_items_id_fk" FOREIGN KEY ("latest_review_item_id") REFERENCES "public"."review_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_event_observations" ADD CONSTRAINT "source_event_observations_published_event_id_events_id_fk" FOREIGN KEY ("published_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_event_observations_target_event_key_unique" ON "source_event_observations" USING btree ("source_target_id","source_event_key");