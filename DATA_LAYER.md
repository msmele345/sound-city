# Sound City Data Layer

This note explains how data currently flows through Sound City, where it is
persisted, and which parts are still MVP scaffolding.

## High-Level Shape

The app has a thin Next.js backend, not a separate backend service. In backend
terms, the structure is:

```text
React dashboard
  -> Next.js route handlers
  -> catalog repository/store layer
  -> Drizzle ORM
  -> Postgres driver
  -> Neon Postgres
```

When no database connection string is configured, the lower half changes to an
in-memory seed-backed store:

```text
React dashboard
  -> Next.js route handlers
  -> catalog repository/store layer
  -> in-memory launch data
```

The important point is that the UI and route handlers talk to a catalog store
interface. They do not need to know whether the data came from Neon Postgres or
from the local seed fallback.

## Client Read Path

The current event feed is loaded by the dashboard client component.

1. The dashboard renders.
2. `EventDiscoveryFeed` runs a client-side fetch after mount:

   ```ts
   fetch("/api/catalog/events?city=chicago")
   ```

3. The API route handler reads the `city` query param.
4. The route calls `getCatalogStore()`.
5. The selected catalog store returns city-scoped catalog records.
6. The route returns JSON to the browser.
7. The React component stores the response in component state and renders the
   event feed.

Key files:

- `src/components/dashboard-shell.tsx`
- `src/app/api/catalog/events/route.ts`
- `src/app/api/catalog/venues/route.ts`
- `src/app/api/catalog/artists/route.ts`
- `src/app/api/catalog/showcase/route.ts`

## Catalog Store Boundary

The main abstraction is in `src/server/catalog/catalog-store.ts`.

`CatalogReader` is the read interface:

```ts
type CatalogReader = {
  listCities(): Promise<CityRecord[]>;
  listEvents(citySlug: string): Promise<EventRecord[]>;
  listVenues(citySlug: string): Promise<VenueRecord[]>;
  listArtists(citySlug: string): Promise<ArtistRecord[]>;
  getShowcase(citySlug: string): Promise<ArtistRecord | null>;
};
```

`CatalogStore` extends that with write operations:

```ts
type CatalogStore = CatalogReader & {
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
```

This is the repository contract for the catalog. Route handlers and future Admin
workflows should depend on this contract rather than reaching directly into
Drizzle everywhere.

## Store Selection

`getCatalogStore()` is the switch:

```ts
export function getCatalogStore() {
  if (process.env.DATABASE_URL) {
    databaseStore ??= createDrizzleCatalogStore(createDb());
    return databaseStore;
  }

  fallbackStore ??= createSeedCatalogStore();
  return fallbackStore;
}
```

If `DATABASE_URL` exists, the app uses Drizzle over Postgres. If it is missing,
the app uses a cloned copy of `launchCatalogData` in process memory.

That gives the app a useful local/test mode, but it also means local fallback
writes are not durable.

## Database Connection

The database client is in `src/server/db/client.ts`.

```ts
const client = postgres(connectionString, {
  max: 1,
  prepare: false,
});

return drizzle(client, { schema });
```

The app uses:

- `postgres` as the low-level Postgres driver.
- `drizzle-orm` as the typed database layer.
- `DATABASE_URL` as the environment variable for the connection string.

In production or preview, `DATABASE_URL` should point at Neon Postgres. Neon is
still Postgres from the application's perspective: the app connects with a
standard Postgres connection string.

For serverless/Vercel-style workloads, a pooled Neon connection string is often
appropriate for request-time app queries. For migrations and schema management,
prefer a direct connection string unless the tool explicitly supports pooled
migration connections.

## Schema

The schema is defined in `src/server/db/schema.ts`, with the generated SQL
migration in `db/migrations/0000_catalog_foundation.sql`.

Current tables:

- `cities`
- `sources`
- `venues`
- `artists`
- `artist_links`
- `events`
- `event_artists`
- `venue_signals`

The model is normalized:

- Events belong to a city.
- Events belong to a venue.
- Events point to source provenance.
- Artists belong to a city.
- Artist listening/profile links are separate rows.
- Events and artists are many-to-many through `event_artists`.
- Venue signals are separate rows attached to venues.
- Source metadata is centralized in `sources`.

The public API shape is denormalized for the frontend. For example, an event API
record includes the event, venue, artists, styles, and source metadata together.

## Drizzle Catalog Reader

`src/server/catalog/drizzle-catalog-store.ts` adapts database rows into the
application's catalog record types.

The current implementation reads all catalog tables with `findMany()`, builds
maps in memory, and returns nested records:

- source rows become `SourceRecord`s
- venue rows get city slug, source, and venue signals
- artist rows get city slug, source, and links
- event rows get city slug, venue, artists, styles, and source

This is simple and acceptable for the MVP-sized launch catalog. As data grows,
the likely refactor is to push more filtering and joins into SQL instead of
reading every catalog table for each request.

## Seed Data

The launch dataset lives in `src/server/catalog/launch-data.ts`.

`scripts/seed.ts` writes that launch dataset into Postgres:

```bash
npm run db:seed
```

The seed script inserts cities, sources, venues, artists, artist links, events,
event artists, and venue signals. It uses `onConflictDoNothing()`, so seeding is
intended to be idempotent for the same IDs.

Schema commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`drizzle.config.ts` points Drizzle Kit at:

- schema: `./src/server/db/schema.ts`
- migration output: `./db/migrations`
- credentials: `process.env.DATABASE_URL`

## Where Data Is Persisted

There are currently three persistence stories.

### 1. Catalog Data In Neon Postgres

Catalog data is durable when:

- `DATABASE_URL` is set.
- migrations have been applied with `npm run db:migrate`.
- seed data or future Admin writes have inserted rows into Postgres.

This is the production persistence target for cities, venues, artists, events,
links, signals, and source metadata.

### 2. Catalog Data In Local Fallback Memory

If `DATABASE_URL` is missing, the app uses `createSeedCatalogStore()`.

That store clones `launchCatalogData` into memory and reuses it as a module-level
singleton for the running process.

This is not durable persistence. Changes survive only as long as that Node
process/module instance survives. Restarting the dev server, redeploying, or
running in a different serverless instance resets the data back to launch data.

This fallback is useful for tests, local UI work, and keeping the app usable
without provisioning a database.

### 3. User Personalization In Browser Storage

This is planned but not implemented yet.

The PRD says v1 has no authentication, so personalization will live in the
user's browser. Phase 4 calls for storing:

- taste profile settings
- saved events
- dismissed events
- attended events

Today, the event style filter is React component state only. It is lost on page
reload.

When Phase 4 is implemented, user-specific recommendation signals should persist
in browser storage, while shared catalog data remains in Postgres.

## Write Path Status

This is the main caveat in the current data layer.

`src/server/catalog/operations.ts` contains server-side create, update, and
delete operations for venues, artists, and events. Those operations validate
input and call a `CatalogStore`.

The seed-backed store implements the write methods in memory.

The Drizzle-backed store currently implements `CatalogReader`, not the full
`CatalogStore` write surface. That means production database reads are wired,
but durable production Admin CRUD writes still need a Drizzle write
implementation.

Before Admin CRUD is considered production-persistent, the app needs either:

- a Drizzle-backed `CatalogStore` that implements create/update/delete, or
- route-level mutation handlers that write directly through Drizzle.

The cleaner path is probably to keep the repository boundary and add a
Drizzle-backed write store so Admin routes and tests can share one contract.

## Mental Model

If you usually connect to a database from a backend app, treat the Next.js route
handlers as the backend controller layer.

The browser should not connect to Neon directly. The browser calls `/api/*`.
Those API route handlers run server-side in Next.js, use environment variables,
and call the catalog store.

The catalog store is the app's data access boundary:

- it hides whether the app is using Postgres or fallback seed data
- it returns frontend-friendly catalog records
- it gives future Admin workflows a stable place to plug in writes

The current implementation is intentionally simple for MVP scale. The next
natural hardening steps are durable Drizzle writes, more selective database
queries, and browser-local persistence for Phase 4 personalization.
