import type { RecommendationEvent } from "@/lib/recommendations";

export type CatalogEvent = RecommendationEvent & {
  id: string;
  citySlug?: string;
  title: string;
  slug?: string;
  startsAt: string;
  venue: {
    name: string;
    slug?: string;
    neighborhood: string;
    capacity: number | null;
  };
  artists: { name: string; slug?: string }[];
  styles: string[];
  source: {
    title: string;
    url: string;
    lastVerifiedAt: string;
  };
};

export type EventFeedState =
  | { status: "loading"; events: CatalogEvent[] }
  | { status: "ready"; events: CatalogEvent[] }
  | { status: "error"; events: CatalogEvent[] };

export type CatalogSource = {
  title: string;
  url: string;
  lastVerifiedAt: string;
};

export type CatalogArtistLink = {
  id: string;
  kind: string;
  label: string;
  url: string;
  source: CatalogSource;
};

export type ShowcaseArtist = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  bio: string;
  styles: string[];
  showcase: boolean;
  source: CatalogSource;
  links: CatalogArtistLink[];
};

export type ShowcaseState =
  | { status: "loading"; artist: null }
  | { status: "ready"; artist: ShowcaseArtist | null }
  | { status: "error"; artist: null };

export type ArtistDirectoryState =
  | { status: "loading"; artists: ShowcaseArtist[] }
  | { status: "ready"; artists: ShowcaseArtist[] }
  | { status: "error"; artists: ShowcaseArtist[] };

export type CatalogVenueSignal = {
  id: string;
  category: "sound" | "crowd" | "room" | "door" | "layout";
  value: string;
  source: CatalogSource;
};

export type CatalogVenue = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  neighborhood: string;
  address: string;
  capacity: number | null;
  source: CatalogSource;
  signals: CatalogVenueSignal[];
};

export type VenueDirectoryState =
  | { status: "loading"; venues: CatalogVenue[] }
  | { status: "ready"; venues: CatalogVenue[] }
  | { status: "error"; venues: CatalogVenue[] };
