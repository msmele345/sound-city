import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
