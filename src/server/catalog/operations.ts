import type {
  ArtistLinkRecord,
  ArtistRecord,
  CatalogSnapshot,
  CreateArtistLinkInput,
  CreateArtistInput,
  CreateEventInput,
  CreateVenueInput,
  CreateVenueSignalInput,
  EventRecord,
  SourceInput,
  SourceRecord,
  UpdateArtistLinkInput,
  UpdateArtistInput,
  UpdateEventInput,
  UpdateVenueInput,
  UpdateVenueSignalInput,
  VenueRecord,
  VenueSignalRecord,
} from "./types";

import type { CatalogStore } from "./catalog-store";

function assertPresent(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function slugFromText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function assertSource(source: SourceInput) {
  assertPresent(source.title, "source title");
  assertPresent(source.url, "source URL");
  assertPresent(source.lastVerifiedAt, "source last verified date");

  try {
    new URL(source.url);
  } catch {
    throw new Error("source URL must be a valid URL");
  }
}

function sourceFromInput(prefix: string, slug: string, source: SourceInput): SourceRecord {
  assertSource(source);
  return {
    id: `source_${prefix}_${slug}`,
    ...source,
  };
}

function recordId(prefix: string, slug: string) {
  return `${prefix}_${slug.replaceAll("-", "_")}`;
}

const artistLinkKinds = new Set<ArtistLinkRecord["kind"]>([
  "official",
  "soundcloud",
  "bandcamp",
  "youtube",
  "resident-advisor",
]);

function assertArtistLinkKind(kind: ArtistLinkRecord["kind"]) {
  if (!artistLinkKinds.has(kind)) {
    throw new Error("artist link kind is invalid");
  }
}

const venueSignalCategories = new Set<VenueSignalRecord["category"]>([
  "sound",
  "crowd",
  "room",
  "door",
  "layout",
]);

function assertVenueSignalCategory(category: VenueSignalRecord["category"]) {
  if (!venueSignalCategories.has(category)) {
    throw new Error("venue signal category is invalid");
  }
}

export async function createVenue(
  store: CatalogStore,
  input: CreateVenueInput,
): Promise<VenueRecord> {
  assertPresent(input.citySlug, "city slug");
  assertPresent(input.name, "venue name");
  assertPresent(input.slug, "venue slug");
  assertPresent(input.neighborhood, "venue neighborhood");
  assertPresent(input.address, "venue address");

  const venue: VenueRecord = {
    ...input,
    id: recordId("venue", input.slug),
    source: sourceFromInput("venue", input.slug, input.source),
    signals: [],
  };

  return store.createVenue(venue);
}

export async function updateVenue(
  store: CatalogStore,
  id: string,
  input: UpdateVenueInput,
): Promise<VenueRecord> {
  const venues = await store.listVenues("chicago");
  const existing = venues.find((venue) => venue.id === id);
  if (!existing) {
    throw new Error("Venue not found");
  }

  return store.updateVenue(id, {
    ...existing,
    ...input,
    source: input.source
      ? sourceFromInput("venue", existing.slug, input.source)
      : existing.source,
  });
}

export async function deleteVenue(store: CatalogStore, id: string) {
  await store.deleteVenue(id);
}

export async function createArtist(
  store: CatalogStore,
  input: CreateArtistInput,
): Promise<ArtistRecord> {
  assertPresent(input.citySlug, "city slug");
  assertPresent(input.name, "artist name");
  assertPresent(input.slug, "artist slug");

  const artist: ArtistRecord = {
    ...input,
    id: recordId("artist", input.slug),
    bio: input.bio ?? "",
    showcase: input.showcase ?? false,
    source: sourceFromInput("artist", input.slug, input.source),
    links: [],
  };

  return store.createArtist(artist);
}

export async function updateArtist(
  store: CatalogStore,
  id: string,
  input: UpdateArtistInput,
): Promise<ArtistRecord> {
  const artists = await store.listArtists("chicago");
  const existing = artists.find((artist) => artist.id === id);
  if (!existing) {
    throw new Error("Artist not found");
  }

  return store.updateArtist(id, {
    ...existing,
    ...input,
    source: input.source
      ? sourceFromInput("artist", existing.slug, input.source)
      : existing.source,
  });
}

export async function deleteArtist(store: CatalogStore, id: string) {
  await store.deleteArtist(id);
}

export async function createArtistLink(
  store: CatalogStore,
  input: CreateArtistLinkInput,
): Promise<ArtistLinkRecord> {
  assertPresent(input.artistSlug, "artist slug");
  assertPresent(input.label, "artist link label");
  assertPresent(input.url, "artist link URL");
  assertArtistLinkKind(input.kind);

  try {
    new URL(input.url);
  } catch {
    throw new Error("artist link URL must be a valid URL");
  }

  const linkSlug = `${input.artistSlug}-${input.kind}-${slugFromText(
    input.label,
  )}`;
  const link: ArtistLinkRecord = {
    ...input,
    id: recordId("link", linkSlug),
    source: sourceFromInput("artist_link", linkSlug, input.source),
  };

  return store.createArtistLink(link);
}

export async function updateArtistLink(
  store: CatalogStore,
  id: string,
  input: UpdateArtistLinkInput,
): Promise<ArtistLinkRecord> {
  const artists = await store.listArtists("chicago");
  const existing = artists.flatMap((artist) => artist.links).find((link) => link.id === id);
  if (!existing) {
    throw new Error("Artist link not found");
  }
  if (input.kind) {
    assertArtistLinkKind(input.kind);
  }
  if (input.url) {
    try {
      new URL(input.url);
    } catch {
      throw new Error("artist link URL must be a valid URL");
    }
  }

  return store.updateArtistLink(id, {
    ...existing,
    ...input,
    source: input.source
      ? sourceFromInput("artist_link", id.replace(/^link_/, ""), input.source)
      : existing.source,
  });
}

export async function deleteArtistLink(store: CatalogStore, id: string) {
  await store.deleteArtistLink(id);
}

export async function createEvent(
  store: CatalogStore,
  input: CreateEventInput,
): Promise<EventRecord> {
  assertPresent(input.citySlug, "city slug");
  assertPresent(input.title, "event title");
  assertPresent(input.slug, "event slug");
  assertPresent(input.startsAt, "event start date");

  const [venues, artists] = await Promise.all([
    store.listVenues(input.citySlug),
    store.listArtists(input.citySlug),
  ]);
  const venue = venues.find((current) => current.slug === input.venueSlug);
  if (!venue) {
    throw new Error("Event venue not found");
  }

  const eventArtists = input.artistSlugs.map((slug) => {
    const artist = artists.find((current) => current.slug === slug);
    if (!artist) {
      throw new Error(`Event artist not found: ${slug}`);
    }
    return artist;
  });

  const event: EventRecord = {
    id: recordId("event", input.slug),
    citySlug: input.citySlug,
    title: input.title,
    slug: input.slug,
    startsAt: input.startsAt,
    venue,
    artists: eventArtists,
    styles: input.styles,
    source: sourceFromInput("event", input.slug, input.source),
  };

  return store.createEvent(event);
}

export async function updateEvent(
  store: CatalogStore,
  id: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const events = await store.listEvents("chicago");
  const existing = events.find((event) => event.id === id);
  if (!existing) {
    throw new Error("Event not found");
  }

  const [venues, artists] = await Promise.all([
    store.listVenues(existing.citySlug),
    store.listArtists(existing.citySlug),
  ]);
  const venue = input.venueSlug
    ? venues.find((current) => current.slug === input.venueSlug)
    : existing.venue;
  if (!venue) {
    throw new Error("Event venue not found");
  }

  const eventArtists = input.artistSlugs
    ? input.artistSlugs.map((slug) => {
        const artist = artists.find((current) => current.slug === slug);
        if (!artist) {
          throw new Error(`Event artist not found: ${slug}`);
        }
        return artist;
      })
    : existing.artists;

  return store.updateEvent(id, {
    ...existing,
    ...input,
    venue,
    artists: eventArtists,
    source: input.source
      ? sourceFromInput("event", existing.slug, input.source)
      : existing.source,
  });
}

export async function deleteEvent(store: CatalogStore, id: string) {
  await store.deleteEvent(id);
}

export async function createVenueSignal(
  store: CatalogStore,
  input: CreateVenueSignalInput,
): Promise<VenueSignalRecord> {
  assertPresent(input.venueSlug, "venue slug");
  assertPresent(input.value, "venue signal value");
  assertVenueSignalCategory(input.category);

  const signalSlug = `${input.venueSlug}-${input.category}-${slugFromText(
    input.value,
  )}`;
  const signal: VenueSignalRecord = {
    ...input,
    id: recordId("signal", signalSlug),
    source: sourceFromInput("venue_signal", signalSlug, input.source),
  };

  return store.createVenueSignal(signal);
}

export async function updateVenueSignal(
  store: CatalogStore,
  id: string,
  input: UpdateVenueSignalInput,
): Promise<VenueSignalRecord> {
  const venues = await store.listVenues("chicago");
  const existing = venues
    .flatMap((venue) => venue.signals)
    .find((signal) => signal.id === id);
  if (!existing) {
    throw new Error("Venue signal not found");
  }
  if (input.category) {
    assertVenueSignalCategory(input.category);
  }

  return store.updateVenueSignal(id, {
    ...existing,
    ...input,
    source: input.source
      ? sourceFromInput("venue_signal", id.replace(/^signal_/, ""), input.source)
      : existing.source,
  });
}

export async function deleteVenueSignal(store: CatalogStore, id: string) {
  await store.deleteVenueSignal(id);
}

export function collectSources(snapshot: CatalogSnapshot) {
  const sources = new Map<string, SourceRecord>();

  for (const venue of snapshot.venues) {
    sources.set(venue.source.id, venue.source);
    for (const signal of venue.signals) {
      sources.set(signal.source.id, signal.source);
    }
  }

  for (const artist of snapshot.artists) {
    sources.set(artist.source.id, artist.source);
    for (const link of artist.links) {
      sources.set(link.source.id, link.source);
    }
  }

  for (const event of snapshot.events) {
    sources.set(event.source.id, event.source);
  }

  return [...sources.values()];
}
