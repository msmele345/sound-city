import { launchCatalogData } from "./launch-data";
import { createDrizzleCatalogStore } from "./drizzle-catalog-store";
import { createDb } from "../db/client";
import type {
  ArtistLinkRecord,
  ArtistRecord,
  CatalogSnapshot,
  CityRecord,
  EventRecord,
  VenueRecord,
  VenueSignalRecord,
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
  createArtistLink(link: ArtistLinkRecord): Promise<ArtistLinkRecord>;
  updateArtistLink(id: string, link: ArtistLinkRecord): Promise<ArtistLinkRecord>;
  deleteArtistLink(id: string): Promise<void>;
  createEvent(event: EventRecord): Promise<EventRecord>;
  updateEvent(id: string, event: EventRecord): Promise<EventRecord>;
  deleteEvent(id: string): Promise<void>;
  createVenueSignal(signal: VenueSignalRecord): Promise<VenueSignalRecord>;
  updateVenueSignal(
    id: string,
    signal: VenueSignalRecord,
  ): Promise<VenueSignalRecord>;
  deleteVenueSignal(id: string): Promise<void>;
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
    async createArtistLink(link) {
      const artist = snapshot.artists.find(
        (current) => current.slug === link.artistSlug,
      );
      if (!artist) {
        throw new Error("Artist not found");
      }
      artist.links.push(link);
      return link;
    },
    async updateArtistLink(id, link) {
      for (const artist of snapshot.artists) {
        const index = artist.links.findIndex((current) => current.id === id);
        if (index !== -1) {
          artist.links[index] = link;
          return link;
        }
      }
      throw new Error("Artist link not found");
    },
    async deleteArtistLink(id) {
      for (const artist of snapshot.artists) {
        const index = artist.links.findIndex((link) => link.id === id);
        if (index !== -1) {
          artist.links.splice(index, 1);
          return;
        }
      }
      throw new Error("Artist link not found");
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
    async createVenueSignal(signal) {
      const venue = snapshot.venues.find(
        (current) => current.slug === signal.venueSlug,
      );
      if (!venue) {
        throw new Error("Venue not found");
      }
      venue.signals.push(signal);
      snapshot.events = snapshot.events.map((event) =>
        event.venue.slug === venue.slug ? { ...event, venue } : event,
      );
      return signal;
    },
    async updateVenueSignal(id, signal) {
      for (const venue of snapshot.venues) {
        const index = venue.signals.findIndex((current) => current.id === id);
        if (index !== -1) {
          venue.signals[index] = signal;
          snapshot.events = snapshot.events.map((event) =>
            event.venue.slug === venue.slug ? { ...event, venue } : event,
          );
          return signal;
        }
      }
      throw new Error("Venue signal not found");
    },
    async deleteVenueSignal(id) {
      for (const venue of snapshot.venues) {
        const index = venue.signals.findIndex((signal) => signal.id === id);
        if (index !== -1) {
          venue.signals.splice(index, 1);
          snapshot.events = snapshot.events.map((event) =>
            event.venue.slug === venue.slug ? { ...event, venue } : event,
          );
          return;
        }
      }
      throw new Error("Venue signal not found");
    },
  };
}

let fallbackStore: CatalogStore | null = null;
let databaseStore: CatalogStore | null = null;

export function getCatalogStore() {
  if (process.env.DATABASE_URL) {
    databaseStore ??= createDrizzleCatalogStore(createDb());
    return databaseStore;
  }

  fallbackStore ??= createSeedCatalogStore();
  return fallbackStore;
}
