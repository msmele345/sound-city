# Vercel Preview CD

Sound City uses Vercel preview deployments to validate feature branches and pull
requests before they merge into `develop`.

## Deployment Model

- `main` is the production branch.
- `develop` is the integration branch.
- `feature/*` branches should open pull requests into `develop`.
- Vercel should create preview deployments for non-production branches and pull
  requests.
- Production deployments should only come from `main`.

## Project Link

The local checkout is linked to the Vercel project through `.vercel/project.json`.
That local link allows CLI deployments, but continuous deployment depends on the
Vercel project being connected to the GitHub repository:

```text
git@github.com:msmele345/sound-city.git
```

Confirm this in Vercel:

1. Open the Sound City project in Vercel.
2. Go to Project Settings -> Git.
3. Confirm the Git repository is connected to `msmele345/sound-city`.
4. Confirm the production branch is `main`.
5. Confirm preview deployments are enabled for pull requests and non-production
   branches.

## Build Validation

`vercel.json` overrides the deployment build command so each preview deployment
must pass:

```bash
NODE_ENV=test npm test
npm run lint
npm run build
npm run typecheck
```

This mirrors the local verification cadence and prevents previews from building
when tests, TypeScript, linting, or the Next.js build fail.

Vercel runs custom build commands in a production deployment environment, so the
test step explicitly sets `NODE_ENV=test`. React Testing Library needs React's
test environment support for `act`, while `next build` should continue to run in
production mode.

## Environment Variables

Set the following Vercel environment variable for preview and production:

```text
DATABASE_URL
```

`DATABASE_URL` should point at the Neon Postgres database used by the deployed
environment. If it is missing, the app falls back to the seed-backed in-memory
catalog store, which is useful locally but should not be the deployed preview
baseline.

## Preview Validation

After a feature branch is pushed or a pull request is opened:

1. Open the Vercel preview URL from the pull request or Vercel dashboard.
2. Check the dashboard first screen on desktop and mobile widths.
3. Check `/api/catalog/events?city=chicago`.
4. Check `/api/catalog/venues?city=chicago`.
5. Check `/api/catalog/artists?city=chicago`.
6. Check `/api/catalog/showcase?city=chicago`.
7. Confirm event data comes from Neon, not the local seed fallback.

## First Validated Preview

The first captured preview deployment is:

```text
https://sound-city-n1worcnm0-mitchmele-5636s-projects.vercel.app
```

Validation date: 2026-05-30

Vercel inspection:

- Deployment ID: `dpl_8mWgTXZVMzRnrocRcJghD4AeZjEo`
- Target: `preview`
- Status: `READY`
- Created: 2026-05-29 16:01:45 CDT
- Build command: `NODE_ENV=test npm test && npm run lint && npm run build && npm run typecheck`
- Deployment Protection: enabled. Direct unauthenticated `curl` returns `HTTP/2 401`; use `npx vercel curl` for maintainer validation.

Validated through `npx vercel curl`:

- `/` renders the Sound City dashboard HTML with `Sound City`, `Recommended Tonight`, `Latest Events`, `Artist Showcase`, and `Venue Signals`.
- `/api/catalog/events?city=chicago` returns the Chicago catalog and events including `Family Matters feat. Posthuman`, `Lemtom at Spybar`, and `Jeremy Olander Open-to-Close`.
- `/api/catalog/venues?city=chicago` returns `smartbar`, `Spybar`, and `Podlasie Club`.
- `/api/catalog/artists?city=chicago` returns `Posthuman`, `Lemtom`, and `Jeremy Olander`.
- `/api/catalog/showcase?city=chicago` returns `Posthuman` as the showcase artist.
