CREATE TABLE IF NOT EXISTS "cities" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "time_zone" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "sources" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "last_verified_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "venues" (
  "id" text PRIMARY KEY NOT NULL,
  "city_id" text NOT NULL REFERENCES "cities"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "neighborhood" text NOT NULL,
  "address" text NOT NULL,
  "capacity" integer
);

CREATE TABLE IF NOT EXISTS "artists" (
  "id" text PRIMARY KEY NOT NULL,
  "city_id" text NOT NULL REFERENCES "cities"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "bio" text DEFAULT '' NOT NULL,
  "styles" text[] NOT NULL,
  "showcase" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "artist_links" (
  "id" text PRIMARY KEY NOT NULL,
  "artist_id" text NOT NULL REFERENCES "artists"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "url" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY NOT NULL,
  "city_id" text NOT NULL REFERENCES "cities"("id"),
  "venue_id" text NOT NULL REFERENCES "venues"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "starts_at" timestamp with time zone NOT NULL,
  "styles" text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS "event_artists" (
  "event_id" text NOT NULL REFERENCES "events"("id"),
  "artist_id" text NOT NULL REFERENCES "artists"("id"),
  PRIMARY KEY ("event_id", "artist_id")
);

CREATE TABLE IF NOT EXISTS "venue_signals" (
  "id" text PRIMARY KEY NOT NULL,
  "venue_id" text NOT NULL REFERENCES "venues"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "category" text NOT NULL,
  "value" text NOT NULL
);
