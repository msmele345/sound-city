import { eq } from "drizzle-orm";

import { launchCatalogData } from "../src/server/catalog/launch-data";
import { collectSources } from "../src/server/catalog/operations";
import { createDb } from "../src/server/db/client";
import {
  artistLinks,
  artists,
  cities,
  eventArtists,
  events,
  sources,
  venueSignals,
  venues,
} from "../src/server/db/schema";

const db = createDb();

async function main() {
  const cityBySlug = new Map(
    launchCatalogData.cities.map((city) => [city.slug, city]),
  );
  const venueBySlug = new Map(
    launchCatalogData.venues.map((venue) => [venue.slug, venue]),
  );
  const artistBySlug = new Map(
    launchCatalogData.artists.map((artist) => [artist.slug, artist]),
  );

  await db.insert(cities).values(launchCatalogData.cities).onConflictDoNothing();

  await db
    .insert(sources)
    .values(
      collectSources(launchCatalogData).map((source) => ({
        ...source,
        lastVerifiedAt: `${source.lastVerifiedAt} 00:00:00`,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(venues)
    .values(
      launchCatalogData.venues.map((venue) => ({
        id: venue.id,
        cityId: cityBySlug.get(venue.citySlug)!.id,
        sourceId: venue.source.id,
        name: venue.name,
        slug: venue.slug,
        neighborhood: venue.neighborhood,
        address: venue.address,
        capacity: venue.capacity,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(artists)
    .values(
      launchCatalogData.artists.map((artist) => ({
        id: artist.id,
        cityId: cityBySlug.get(artist.citySlug)!.id,
        sourceId: artist.source.id,
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio,
        styles: artist.styles,
        showcase: artist.showcase,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(artistLinks)
    .values(
      launchCatalogData.artists.flatMap((artist) =>
        artist.links.map((link) => ({
          id: link.id,
          artistId: artist.id,
          sourceId: link.source.id,
          kind: link.kind,
          label: link.label,
          url: link.url,
        })),
      ),
    )
    .onConflictDoNothing();

  await db
    .insert(events)
    .values(
      launchCatalogData.events.map((event) => ({
        id: event.id,
        cityId: cityBySlug.get(event.citySlug)!.id,
        venueId: venueBySlug.get(event.venue.slug)!.id,
        sourceId: event.source.id,
        title: event.title,
        slug: event.slug,
        startsAt: event.startsAt,
        styles: event.styles,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(eventArtists)
    .values(
      launchCatalogData.events.flatMap((event) =>
        event.artists.map((artist) => ({
          eventId: event.id,
          artistId: artistBySlug.get(artist.slug)!.id,
        })),
      ),
    )
    .onConflictDoNothing();

  await db
    .insert(venueSignals)
    .values(
      launchCatalogData.venues.flatMap((venue) =>
        venue.signals.map((signal) => ({
          id: signal.id,
          venueId: venue.id,
          sourceId: signal.source.id,
          category: signal.category,
          value: signal.value,
        })),
      ),
    )
    .onConflictDoNothing();

  const chicago = await db.query.cities.findFirst({
    where: eq(cities.slug, "chicago"),
  });

  console.log(`Seeded Sound City catalog for ${chicago?.name ?? "Chicago"}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
