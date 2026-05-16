# Manual Data Refresh

Sound City v1 uses manually verified public data. Automated scraping and scheduled ingestion are out of scope, so catalog refreshes should be small, reviewable edits.

## Environment

Create `.env.local` for local Neon work:

```bash
DATABASE_URL="postgres://..."
```

Use the same variable in Vercel project settings for preview and production deployments.

## Refresh Steps

1. Review public event calendars and venue pages for Chicago house and techno records.
2. Add or update records in `src/server/catalog/launch-data.ts`.
3. Include the public `source.url`, `source.title`, and `source.lastVerifiedAt` date for every real event, venue, artist, artist link, and venue signal.
4. Run `npm test` and `npm run typecheck`.
5. Run `npm run db:migrate` against the target Neon branch when schema changes exist.
6. Run `npm run db:seed` to insert launch data into the target database.
7. Open `/api/catalog/events?city=chicago`, `/api/catalog/venues?city=chicago`, `/api/catalog/artists?city=chicago`, and `/api/catalog/showcase?city=chicago` in the deployed preview.

## Source Rules

- Prefer official venue, ticketing, artist, or Resident Advisor listings.
- Do not add unsourced social rumors or unverified location details.
- Use ISO dates for `lastVerifiedAt`.
- Remove or archive stale event records after they are no longer useful for demo data.
