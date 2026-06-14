ALTER TABLE "review_items" ALTER COLUMN "source_target_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "source_targets" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_targets" ADD COLUMN "rejection_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_targets" ADD COLUMN "duplicate_count" integer DEFAULT 0 NOT NULL;