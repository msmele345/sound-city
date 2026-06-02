# Manual Data Refresh

Sound City v1 uses manually verified public data. Automated scraping and scheduled ingestion are out of scope, so catalog refreshes should be small, reviewable edits.

## Environment

Create `.env.local` for local Neon work:

```bash
DATABASE_URL="postgres://..."
ADMIN_SECRET="local-maintainer-secret"
```

Use the same variables in Vercel project settings for preview and production
deployments. `ADMIN_SECRET` protects `/admin` and `/api/admin/catalog` when it
is configured. Local development may omit it, but deployed maintainer
environments should set it.

## Refresh Options

Use the Admin UI for ordinary event, venue, artist, artist link, venue signal,
and source maintenance. Edit `src/server/catalog/launch-data.ts` only when the
seed baseline itself needs to change and should be reviewed in git.

## Admin UI Refresh Steps

1. Open `/admin` in the protected preview or local app.
2. Enter the maintainer secret if the unlock form appears.
3. Review the Catalog Lists column for stale event dates, broken source links,
   missing artist links, and venue signals that no longer match public sources.
4. Create or edit records with the Admin forms. Keep `citySlug` values pointed
   at `chicago` for v1 launch data.
5. Use official venue, ticketing, artist, Bandcamp, SoundCloud, YouTube, or
   Resident Advisor pages as source URLs.
6. Set `source.title`, `source.url`, and `source.lastVerifiedAt` on every
   record. Use the date the maintainer personally checked the source.
7. Delete stale demo events only after confirming they are no longer useful for
   launch validation.
8. Open `/api/catalog/events?city=chicago`,
   `/api/catalog/venues?city=chicago`,
   `/api/catalog/artists?city=chicago`, and
   `/api/catalog/showcase?city=chicago` in the same preview to confirm the
   public catalog reflects the refresh.

## Seed Refresh Steps

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

## Verification

Before considering a refresh ready for review, run:

```bash
npm test
npm run lint
npm run build
npm run typecheck
```

Then verify the dashboard at desktop and mobile widths. Check that Recommended
Tonight, Latest Events, Artist Showcase, and Venue Signals still render without
overlap, that keyboard focus reaches primary navigation and action buttons, and
that source links open the intended public records.
