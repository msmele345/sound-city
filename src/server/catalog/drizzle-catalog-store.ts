import { eq } from "drizzle-orm";

import type { CatalogStore } from "./catalog-store";
import type {
  ArtistLinkRecord,
  ArtistRecord,
  CityRecord,
  EventRecord,
  SourceRecord,
  VenueRecord,
  VenueSignalRecord,
} from "./types";
import type { createDb } from "../db/client";
import * as schema from "../db/schema";

type FindManyTable<Row> = {
  findMany(): Promise<Row[]>;
};

type CityRow = CityRecord;
type SourceRow = {
  id: string;
  title: string;
  url: string;
  lastVerifiedAt: string | Date;
};
type VenueRow = {
  id: string;
  cityId: string;
  sourceId: string;
  name: string;
  slug: string;
  neighborhood: string;
  address: string;
  capacity: number | null;
};
type ArtistRow = {
  id: string;
  cityId: string;
  sourceId: string;
  name: string;
  slug: string;
  bio: string;
  styles: string[];
  showcase: boolean;
};
type ArtistLinkRow = {
  id: string;
  artistId: string;
  sourceId: string;
  kind: string;
  label: string;
  url: string;
};
type EventRow = {
  id: string;
  cityId: string;
  venueId: string;
  sourceId: string;
  title: string;
  slug: string;
  startsAt: string | Date;
  styles: string[];
};
type EventArtistRow = {
  eventId: string;
  artistId: string;
};
type VenueSignalRow = {
  id: string;
  venueId: string;
  sourceId: string;
  category: string;
  value: string;
};

export type CatalogDbReader = {
  query: {
    cities: FindManyTable<CityRow>;
    sources: FindManyTable<SourceRow>;
    venues: FindManyTable<VenueRow>;
    artists: FindManyTable<ArtistRow>;
    artistLinks: FindManyTable<ArtistLinkRow>;
    events: FindManyTable<EventRow>;
    eventArtists: FindManyTable<EventArtistRow>;
    venueSignals: FindManyTable<VenueSignalRow>;
  };
};

type CatalogDbWriter = Pick<ReturnType<typeof createDb>, "delete" | "insert" | "update">;

type CatalogDb = CatalogDbReader & Partial<CatalogDbWriter>;

function normalizeDate(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function requireRecord<T>(record: T | undefined, label: string): T {
  if (!record) {
    throw new Error(`${label} not found`);
  }
  return record;
}

const artistLinkKinds = new Set<string>([
  "official",
  "soundcloud",
  "bandcamp",
  "youtube",
  "resident-advisor",
]);

function artistLinkKind(value: string): ArtistLinkRecord["kind"] {
  if (!artistLinkKinds.has(value)) {
    throw new Error(`Unknown artist link kind: ${value}`);
  }
  return value as ArtistLinkRecord["kind"];
}

const venueSignalCategories = new Set<string>([
  "sound",
  "crowd",
  "room",
  "door",
  "layout",
]);

function venueSignalCategory(value: string): VenueSignalRecord["category"] {
  if (!venueSignalCategories.has(value)) {
    throw new Error(`Unknown venue signal category: ${value}`);
  }
  return value as VenueSignalRecord["category"];
}

function requireWriter(db: CatalogDb): CatalogDbWriter {
  if (!db.delete || !db.insert || !db.update) {
    throw new Error("Catalog write operations require a Drizzle database");
  }
  return db as CatalogDbWriter;
}

export function createDrizzleCatalogStore(db: CatalogDb): CatalogStore {
  async function readCatalog() {
    const [
      cities,
      sourceRows,
      venueRows,
      artistRows,
      artistLinkRows,
      eventRows,
      eventArtistRows,
      venueSignalRows,
    ] = await Promise.all([
      db.query.cities.findMany(),
      db.query.sources.findMany(),
      db.query.venues.findMany(),
      db.query.artists.findMany(),
      db.query.artistLinks.findMany(),
      db.query.events.findMany(),
      db.query.eventArtists.findMany(),
      db.query.venueSignals.findMany(),
    ]);

    const sources = new Map<string, SourceRecord>(
      sourceRows.map((source) => [
        source.id,
        {
          ...source,
          lastVerifiedAt: normalizeDate(source.lastVerifiedAt),
        },
      ]),
    );
    const citiesById = new Map(cities.map((city) => [city.id, city]));

    const signalsByVenueId = new Map<string, VenueSignalRecord[]>();
    for (const signal of venueSignalRows) {
      const venueSignals = signalsByVenueId.get(signal.venueId) ?? [];
      venueSignals.push({
        id: signal.id,
        venueSlug: "",
        category: venueSignalCategory(signal.category),
        value: signal.value,
        source: requireRecord(sources.get(signal.sourceId), "Signal source"),
      });
      signalsByVenueId.set(signal.venueId, venueSignals);
    }

    const venues = venueRows.map<VenueRecord>((venue) => {
      const city = requireRecord(citiesById.get(venue.cityId), "Venue city");
      const record: VenueRecord = {
        id: venue.id,
        citySlug: city.slug,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        address: venue.address,
        capacity: venue.capacity,
        source: requireRecord(sources.get(venue.sourceId), "Venue source"),
        signals: signalsByVenueId.get(venue.id) ?? [],
      };
      record.signals = record.signals.map((signal) => ({
        ...signal,
        venueSlug: record.slug,
      }));
      return record;
    });
    const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

    const linksByArtistId = new Map<string, ArtistLinkRecord[]>();
    for (const link of artistLinkRows) {
      const artistLinks = linksByArtistId.get(link.artistId) ?? [];
      artistLinks.push({
        id: link.id,
        artistSlug: "",
        kind: artistLinkKind(link.kind),
        label: link.label,
        url: link.url,
        source: requireRecord(sources.get(link.sourceId), "Artist link source"),
      });
      linksByArtistId.set(link.artistId, artistLinks);
    }

    const artists = artistRows.map<ArtistRecord>((artist) => {
      const city = requireRecord(citiesById.get(artist.cityId), "Artist city");
      const record: ArtistRecord = {
        id: artist.id,
        citySlug: city.slug,
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio,
        styles: artist.styles,
        showcase: artist.showcase,
        source: requireRecord(sources.get(artist.sourceId), "Artist source"),
        links: linksByArtistId.get(artist.id) ?? [],
      };
      record.links = record.links.map((link) => ({
        ...link,
        artistSlug: record.slug,
      }));
      return record;
    });
    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

    const artistIdsByEventId = new Map<string, string[]>();
    for (const join of eventArtistRows) {
      const artistIds = artistIdsByEventId.get(join.eventId) ?? [];
      artistIds.push(join.artistId);
      artistIdsByEventId.set(join.eventId, artistIds);
    }

    const events = eventRows
      .map<EventRecord>((event) => {
        const city = requireRecord(citiesById.get(event.cityId), "Event city");
        return {
          id: event.id,
          citySlug: city.slug,
          title: event.title,
          slug: event.slug,
          startsAt: normalizeDate(event.startsAt),
          venue: requireRecord(venuesById.get(event.venueId), "Event venue"),
          artists: (artistIdsByEventId.get(event.id) ?? []).map((artistId) =>
            requireRecord(artistsById.get(artistId), "Event artist"),
          ),
          styles: event.styles,
          source: requireRecord(sources.get(event.sourceId), "Event source"),
        };
      })
      .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));

    return { cities, venues, artists, events };
  }

  async function cityIdFromSlug(citySlug: string) {
    const cities = await db.query.cities.findMany();
    return requireRecord(
      cities.find((city) => city.slug === citySlug)?.id,
      "City",
    );
  }

  async function venueIdFromSlug(slug: string) {
    const venues = await db.query.venues.findMany();
    return requireRecord(
      venues.find((venue) => venue.slug === slug)?.id,
      "Venue",
    );
  }

  async function artistIdFromSlug(slug: string) {
    const artists = await db.query.artists.findMany();
    return requireRecord(
      artists.find((artist) => artist.slug === slug)?.id,
      "Artist",
    );
  }

  async function upsertSource(writer: CatalogDbWriter, source: SourceRecord) {
    await writer
      .insert(schema.sources)
      .values(source)
      .onConflictDoUpdate({
        target: schema.sources.id,
        set: {
          title: source.title,
          url: source.url,
          lastVerifiedAt: source.lastVerifiedAt,
        },
      });
  }

  return {
    async listCities() {
      const catalog = await readCatalog();
      return catalog.cities;
    },
    async listEvents(citySlug) {
      const catalog = await readCatalog();
      return catalog.events.filter((event) => event.citySlug === citySlug);
    },
    async listVenues(citySlug) {
      const catalog = await readCatalog();
      return catalog.venues.filter((venue) => venue.citySlug === citySlug);
    },
    async listArtists(citySlug) {
      const catalog = await readCatalog();
      return catalog.artists.filter((artist) => artist.citySlug === citySlug);
    },
    async getShowcase(citySlug) {
      const catalog = await readCatalog();
      return (
        catalog.artists.find(
          (artist) => artist.citySlug === citySlug && artist.showcase,
        ) ?? null
      );
    },
    async createVenue(venue) {
      const writer = requireWriter(db);
      await upsertSource(writer, venue.source);
      await writer.insert(schema.venues).values({
        id: venue.id,
        cityId: await cityIdFromSlug(venue.citySlug),
        sourceId: venue.source.id,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        address: venue.address,
        capacity: venue.capacity,
      });
      return venue;
    },
    async updateVenue(id, venue) {
      const writer = requireWriter(db);
      await upsertSource(writer, venue.source);
      await writer
        .update(schema.venues)
        .set({
          sourceId: venue.source.id,
          name: venue.name,
          neighborhood: venue.neighborhood,
          address: venue.address,
          capacity: venue.capacity,
        })
        .where(eq(schema.venues.id, id));
      return venue;
    },
    async deleteVenue(id) {
      const writer = requireWriter(db);
      await writer.delete(schema.venues).where(eq(schema.venues.id, id));
    },
    async createArtist(artist) {
      const writer = requireWriter(db);
      await upsertSource(writer, artist.source);
      await writer.insert(schema.artists).values({
        id: artist.id,
        cityId: await cityIdFromSlug(artist.citySlug),
        sourceId: artist.source.id,
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio,
        styles: artist.styles,
        showcase: artist.showcase,
      });
      return artist;
    },
    async updateArtist(id, artist) {
      const writer = requireWriter(db);
      await upsertSource(writer, artist.source);
      await writer
        .update(schema.artists)
        .set({
          sourceId: artist.source.id,
          name: artist.name,
          bio: artist.bio,
          styles: artist.styles,
          showcase: artist.showcase,
        })
        .where(eq(schema.artists.id, id));
      return artist;
    },
    async deleteArtist(id) {
      const writer = requireWriter(db);
      await writer
        .delete(schema.artistLinks)
        .where(eq(schema.artistLinks.artistId, id));
      await writer
        .delete(schema.eventArtists)
        .where(eq(schema.eventArtists.artistId, id));
      await writer.delete(schema.artists).where(eq(schema.artists.id, id));
    },
    async createArtistLink(link) {
      const writer = requireWriter(db);
      await upsertSource(writer, link.source);
      await writer.insert(schema.artistLinks).values({
        id: link.id,
        artistId: await artistIdFromSlug(link.artistSlug),
        sourceId: link.source.id,
        kind: link.kind,
        label: link.label,
        url: link.url,
      });
      return link;
    },
    async updateArtistLink(id, link) {
      const writer = requireWriter(db);
      await upsertSource(writer, link.source);
      await writer
        .update(schema.artistLinks)
        .set({
          sourceId: link.source.id,
          kind: link.kind,
          label: link.label,
          url: link.url,
        })
        .where(eq(schema.artistLinks.id, id));
      return link;
    },
    async deleteArtistLink(id) {
      const writer = requireWriter(db);
      await writer.delete(schema.artistLinks).where(eq(schema.artistLinks.id, id));
    },
    async createEvent(event) {
      const writer = requireWriter(db);
      await upsertSource(writer, event.source);
      await writer.insert(schema.events).values({
        id: event.id,
        cityId: await cityIdFromSlug(event.citySlug),
        venueId: await venueIdFromSlug(event.venue.slug),
        sourceId: event.source.id,
        title: event.title,
        slug: event.slug,
        startsAt: event.startsAt,
        styles: event.styles,
      });
      for (const artist of event.artists) {
        await writer.insert(schema.eventArtists).values({
          eventId: event.id,
          artistId: await artistIdFromSlug(artist.slug),
        });
      }
      return event;
    },
    async updateEvent(id, event) {
      const writer = requireWriter(db);
      await upsertSource(writer, event.source);
      await writer
        .update(schema.events)
        .set({
          venueId: await venueIdFromSlug(event.venue.slug),
          sourceId: event.source.id,
          title: event.title,
          startsAt: event.startsAt,
          styles: event.styles,
        })
        .where(eq(schema.events.id, id));
      await writer
        .delete(schema.eventArtists)
        .where(eq(schema.eventArtists.eventId, id));
      for (const artist of event.artists) {
        await writer.insert(schema.eventArtists).values({
          eventId: event.id,
          artistId: await artistIdFromSlug(artist.slug),
        });
      }
      return event;
    },
    async deleteEvent(id) {
      const writer = requireWriter(db);
      await writer
        .delete(schema.eventArtists)
        .where(eq(schema.eventArtists.eventId, id));
      await writer.delete(schema.events).where(eq(schema.events.id, id));
    },
    async createVenueSignal(signal) {
      const writer = requireWriter(db);
      await upsertSource(writer, signal.source);
      await writer.insert(schema.venueSignals).values({
        id: signal.id,
        venueId: await venueIdFromSlug(signal.venueSlug),
        sourceId: signal.source.id,
        category: signal.category,
        value: signal.value,
      });
      return signal;
    },
    async updateVenueSignal(id, signal) {
      const writer = requireWriter(db);
      await upsertSource(writer, signal.source);
      await writer
        .update(schema.venueSignals)
        .set({
          sourceId: signal.source.id,
          category: signal.category,
          value: signal.value,
        })
        .where(eq(schema.venueSignals.id, id));
      return signal;
    },
    async deleteVenueSignal(id) {
      const writer = requireWriter(db);
      await writer
        .delete(schema.venueSignals)
        .where(eq(schema.venueSignals.id, id));
    },
  };
}
