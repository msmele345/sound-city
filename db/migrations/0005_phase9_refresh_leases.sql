CREATE TABLE "refresh_leases" (
	"city_id" text PRIMARY KEY NOT NULL,
	"active_run_id" text NOT NULL,
	"acquired_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_leases" ADD CONSTRAINT "refresh_leases_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_leases" ADD CONSTRAINT "refresh_leases_active_run_id_refresh_runs_id_fk" FOREIGN KEY ("active_run_id") REFERENCES "public"."refresh_runs"("id") ON DELETE no action ON UPDATE no action;