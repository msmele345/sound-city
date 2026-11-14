# Screenshot fixture

Local-only catalog for UX screenshots, including the visual commits on
[issue #31](https://github.com/msmele345/sound-city/issues/31).

`getCatalogStore()` serves `launchCatalogData` when `DATABASE_URL` is unset.
Those events are dated May 22, May 24, and May 30, 2026. They are already in
the past, so once past events are filtered out of the public feed the in-memory
catalog is empty. This fixture replaces that clone with a denser catalog whose
dates are shifted relative to today: tonight, later this week, and further out.
It is off unless you opt in, and it never runs in production or preview.

## Run

Leave the real database unset. Do not point this at Neon, and do not run
`db:seed` or `db:migrate` for these screenshots.

```bash
DATABASE_URL= SOUND_CITY_SCREENSHOT_FIXTURE=1 npm run dev
```

The same command is saved as:

```bash
npm run dev:screenshots
```

`dev:screenshots` sets `DATABASE_URL` to an empty value before starting Next.js
so a URL in `.env.local` is not loaded. Open
[http://localhost:3000](http://localhost:3000). The Latest Events section is
`#events`.

The flag is `SOUND_CITY_SCREENSHOT_FIXTURE=1`. Any other value, including an
unset variable, keeps the normal launch catalog. A non-empty `DATABASE_URL`
always selects Postgres and ignores the flag. The fixture also stays off when
`VERCEL_ENV` is `production` or `preview`, and when `NODE_ENV` is `production`
(`next build` / `next start`).

## What the catalog contains

The three launch events keep their Chicago wall-clock times and their original
source lines. Family Matters stays at 9:00pm, Lemtom and Jeremy Olander at
10:00pm. The earliest show is placed on today's Chicago date when that time is
still ahead, and on tomorrow when it is not. The other shows keep the same
number of days between them. Extra events, two more artists, and a fourth venue
(Fixture Warehouse) give the feed, day grouping, artist directory, venue
directory, and Saved view enough rows to exercise: multiple events per venue,
listening links on every artist, and several styles.

## Screenshot widths

Capture visual changes at:

- Desktop: 1024×768
- Phone: 375×812

Scroll to the view under test. On the current single-page dashboard, the event
feed is the Latest Events section.
