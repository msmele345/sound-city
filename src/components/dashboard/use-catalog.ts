"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [feedAttempt, setFeedAttempt] = useState(0);
  const [showcaseAttempt, setShowcaseAttempt] = useState(0);
  const [artistAttempt, setArtistAttempt] = useState(0);
  const [venueAttempt, setVenueAttempt] = useState(0);

  const retryFeed = useCallback(() => {
    setFeed({ status: "loading", events: [] });
    setFeedAttempt((attempt) => attempt + 1);
  }, []);
  const retryShowcase = useCallback(() => {
    setShowcase({ status: "loading", artist: null });
    setShowcaseAttempt((attempt) => attempt + 1);
  }, []);
  const retryArtists = useCallback(() => {
    setArtistDirectory({ status: "loading", artists: [] });
    setArtistAttempt((attempt) => attempt + 1);
  }, []);
  const retryVenues = useCallback(() => {
    setVenueDirectory({ status: "loading", venues: [] });
    setVenueAttempt((attempt) => attempt + 1);
  }, []);

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

    void loadEvents();

    return () => {
      active = false;
    };
  }, [feedAttempt]);

  useEffect(() => {
    let active = true;

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

    void loadShowcase();

    return () => {
      active = false;
    };
  }, [showcaseAttempt]);

  useEffect(() => {
    let active = true;

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

    void loadArtists();

    return () => {
      active = false;
    };
  }, [artistAttempt]);

  useEffect(() => {
    let active = true;

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

    void loadVenues();

    return () => {
      active = false;
    };
  }, [venueAttempt]);

  return {
    feed,
    showcase,
    artistDirectory,
    venueDirectory,
    retryFeed,
    retryShowcase,
    retryArtists,
    retryVenues,
  };
}
