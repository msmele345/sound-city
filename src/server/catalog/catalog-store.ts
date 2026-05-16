import { launchCatalogData } from "./launch-data";
import { createDrizzleCatalogStore } from "./drizzle-catalog-store";
import { createDb } from "../db/client";
import type {
  ArtistRecord,
  CatalogSnapshot,
  CityRecord,
  EventRecord,
  VenueRecord,
} from "./types";

export type CatalogReader = {
  listCities(): Promise<CityRecord[]>;
  listEvents(citySlug: string): Promise<EventRecord[]>;
  listVenues(citySlug: string): Promise<VenueRecord[]>;
  listArtists(citySlug: string): Promise<ArtistRecord[]>;
  getShowcase(citySlug: string): Promise<ArtistRecord | null>;
};

export type CatalogStore = CatalogReader & {
  createVenue(venue: VenueRecord): Promise<VenueRecord>;
  updateVenue(id: string, venue: VenueRecord): Promise<VenueRecord>;
  deleteVenue(id: string): Promise<void>;
  createArtist(artist: ArtistRecord): Promise<ArtistRecord>;
  updateArtist(id: string, artist: ArtistRecord): Promise<ArtistRecord>;
  deleteArtist(id: string): Promise<void>;
  createEvent(event: EventRecord): Promise<EventRecord>;
  updateEvent(id: string, event: EventRecord): Promise<EventRecord>;
  deleteEvent(id: string): Promise<void>;
};

function cloneSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return structuredClone(snapshot);
}

export function createSeedCatalogStore(
  initialSnapshot = launchCatalogData,
): CatalogStore {
  const snapshot = cloneSnapshot(initialSnapshot);

  return {
    async listCities() {
      return snapshot.cities;
    },
    async listEvents(citySlug) {
      return snapshot.events
        .filter((event) => event.citySlug === citySlug)
        .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
    async listVenues(citySlug) {
      return snapshot.venues.filter((venue) => venue.citySlug === citySlug);
    },
    async listArtists(citySlug) {
      return snapshot.artists.filter((artist) => artist.citySlug === citySlug);
    },
    async getShowcase(citySlug) {
      return (
        snapshot.artists.find(
          (artist) => artist.citySlug === citySlug && artist.showcase,
        ) ?? null
      );
    },
    async createVenue(venue) {
      snapshot.venues.push(venue);
      return venue;
    },
    async updateVenue(id, venue) {
      const index = snapshot.venues.findIndex((current) => current.id === id);
      if (index === -1) {
        throw new Error("Venue not found");
      }
      snapshot.venues[index] = venue;
      snapshot.events = snapshot.events.map((event) =>
        event.venue.id === id ? { ...event, venue } : event,
      );
      return venue;
    },
    async deleteVenue(id) {
      const index = snapshot.venues.findIndex((venue) => venue.id === id);
      if (index === -1) {
        throw new Error("Venue not found");
      }
      snapshot.venues.splice(index, 1);
    },
    async createArtist(artist) {
      snapshot.artists.push(artist);
      return artist;
    },
    async updateArtist(id, artist) {
      const index = snapshot.artists.findIndex((current) => current.id === id);
      if (index === -1) {
        throw new Error("Artist not found");
      }
      snapshot.artists[index] = artist;
      snapshot.events = snapshot.events.map((event) => ({
        ...event,
        artists: event.artists.map((current) =>
          current.id === id ? artist : current,
        ),
      }));
      return artist;
    },
    async deleteArtist(id) {
      const index = snapshot.artists.findIndex((artist) => artist.id === id);
      if (index === -1) {
        throw new Error("Artist not found");
      }
      snapshot.artists.splice(index, 1);
    },
    async createEvent(event) {
      snapshot.events.push(event);
      return event;
    },
    async updateEvent(id, event) {
      const index = snapshot.events.findIndex((current) => current.id === id);
      if (index === -1) {
        throw new Error("Event not found");
      }
      snapshot.events[index] = event;
      return event;
    },
    async deleteEvent(id) {
      const index = snapshot.events.findIndex((event) => event.id === id);
      if (index === -1) {
        throw new Error("Event not found");
      }
      snapshot.events.splice(index, 1);
    },
  };
}

let fallbackStore: CatalogStore | null = null;
let databaseStore: CatalogReader | null = null;

export function getCatalogStore() {
  if (process.env.DATABASE_URL) {
    databaseStore ??= createDrizzleCatalogStore(createDb());
    return databaseStore;
  }

  fallbackStore ??= createSeedCatalogStore();
  return fallbackStore;
}
