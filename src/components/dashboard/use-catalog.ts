"use client";

import { useEffect, useState } from "react";

import type {
  ArtistDirectoryState,
  CatalogEvent,
  CatalogVenue,
  EventFeedState,
  ShowcaseArtist,
  ShowcaseState,
  VenueDirectoryState,
} from "./types";

export function useCatalog() {
  const [feed, setFeed] = useState<EventFeedState>({
    status: "loading",
    events: [],
  });
  const [showcase, setShowcase] = useState<ShowcaseState>({
    status: "loading",
    artist: null,
  });
  const [artistDirectory, setArtistDirectory] = useState<ArtistDirectoryState>({
    status: "loading",
    artists: [],
  });
  const [venueDirectory, setVenueDirectory] = useState<VenueDirectoryState>({
    status: "loading",
    venues: [],
  });

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      try {
        const response = await fetch("/api/catalog/events?city=chicago");
        if (!response.ok) {
          throw new Error("Event feed unavailable");
        }
        const body = (await response.json()) as { events: CatalogEvent[] };
        if (active) {
          setFeed({ status: "ready", events: body.events });
        }
      } catch {
        if (active) {
          setFeed({ status: "error", events: [] });
        }
      }
    }

    async function loadShowcase() {
      try {
        const response = await fetch("/api/catalog/showcase?city=chicago");
        if (!response.ok) {
          throw new Error("Showcase unavailable");
        }
        const body = (await response.json()) as {
          artist?: ShowcaseArtist | null;
        };
        if (active) {
          setShowcase({ status: "ready", artist: body.artist ?? null });
        }
      } catch {
        if (active) {
          setShowcase({ status: "error", artist: null });
        }
      }
    }

    async function loadArtists() {
      try {
        const response = await fetch("/api/catalog/artists?city=chicago");
        if (!response.ok) {
          throw new Error("Artist directory unavailable");
        }
        const body = (await response.json()) as {
          artists?: ShowcaseArtist[];
        };
        if (active) {
          setArtistDirectory({
            status: "ready",
            artists: Array.isArray(body.artists) ? body.artists : [],
          });
        }
      } catch {
        if (active) {
          setArtistDirectory({ status: "error", artists: [] });
        }
      }
    }

    async function loadVenues() {
      try {
        const response = await fetch("/api/catalog/venues?city=chicago");
        if (!response.ok) {
          throw new Error("Venue directory unavailable");
        }
        const body = (await response.json()) as { venues?: CatalogVenue[] };
        if (active) {
          setVenueDirectory({
            status: "ready",
            venues: Array.isArray(body.venues) ? body.venues : [],
          });
        }
      } catch {
        if (active) {
          setVenueDirectory({ status: "error", venues: [] });
        }
      }
    }

    void loadEvents();
    void loadShowcase();
    void loadArtists();
    void loadVenues();

    return () => {
      active = false;
    };
  }, []);

  return { feed, showcase, artistDirectory, venueDirectory };
}
