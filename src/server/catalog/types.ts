export type SourceRecord = {
  id: string;
  title: string;
  url: string;
  lastVerifiedAt: string;
};

export type CityRecord = {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
};

export type VenueRecord = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  neighborhood: string;
  address: string;
  capacity: number | null;
  source: SourceRecord;
  signals: VenueSignalRecord[];
};

export type VenueSignalRecord = {
  id: string;
  venueSlug: string;
  category: "sound" | "crowd" | "room" | "door" | "layout";
  value: string;
  source: SourceRecord;
};

export type ArtistLinkRecord = {
  id: string;
  artistSlug: string;
  kind: "official" | "soundcloud" | "bandcamp" | "youtube" | "resident-advisor";
  label: string;
  url: string;
  source: SourceRecord;
};

export type ArtistRecord = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  bio: string;
  styles: string[];
  showcase: boolean;
  source: SourceRecord;
  links: ArtistLinkRecord[];
};

export type EventRecord = {
  id: string;
  citySlug: string;
  title: string;
  slug: string;
  startsAt: string;
  venue: VenueRecord;
  artists: ArtistRecord[];
  styles: string[];
  source: SourceRecord;
};

export type CatalogSnapshot = {
  cities: CityRecord[];
  venues: VenueRecord[];
  artists: ArtistRecord[];
  events: EventRecord[];
};

export type SourceInput = Omit<SourceRecord, "id">;

export type CreateVenueInput = Omit<
  VenueRecord,
  "id" | "source" | "signals"
> & {
  source: SourceInput;
};

export type UpdateVenueInput = Partial<
  Pick<VenueRecord, "name" | "neighborhood" | "address" | "capacity">
> & {
  source?: SourceInput;
};

export type CreateArtistInput = Omit<
  ArtistRecord,
  "id" | "bio" | "source" | "links" | "showcase"
> & {
  bio?: string;
  showcase?: boolean;
  source: SourceInput;
};

export type UpdateArtistInput = Partial<
  Pick<ArtistRecord, "name" | "bio" | "styles" | "showcase">
> & {
  source?: SourceInput;
};

export type CreateEventInput = {
  citySlug: string;
  title: string;
  slug: string;
  startsAt: string;
  venueSlug: string;
  artistSlugs: string[];
  styles: string[];
  source: SourceInput;
};

export type UpdateEventInput = Partial<
  Pick<EventRecord, "title" | "startsAt" | "styles">
> & {
  venueSlug?: string;
  artistSlugs?: string[];
  source?: SourceInput;
};

export type CreateArtistLinkInput = Omit<
  ArtistLinkRecord,
  "id" | "source"
> & {
  source: SourceInput;
};

export type UpdateArtistLinkInput = Partial<
  Pick<ArtistLinkRecord, "kind" | "label" | "url">
> & {
  source?: SourceInput;
};

export type CreateVenueSignalInput = Omit<
  VenueSignalRecord,
  "id" | "source"
> & {
  source: SourceInput;
};

export type UpdateVenueSignalInput = Partial<
  Pick<VenueSignalRecord, "category" | "value">
> & {
  source?: SourceInput;
};
