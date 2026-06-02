# Admin Secret Guide

`ADMIN_SECRET` is the maintainer password for Sound City admin tools. When it is
configured, `/admin` and `/api/admin/catalog` require the secret before catalog
records can be viewed or changed.

## What It Protects

- `/admin`
- `/api/admin/catalog`
- Admin create, edit, and delete actions for venues, artists, events, artist
  links, venue signals, and source provenance

This is a lightweight MVP protection layer, not full user authentication. Keep
Vercel Deployment Protection enabled for previews and production as the outer
access-control layer.

## Set The Secret Locally

Add this to `.env.local`:

```bash
ADMIN_SECRET="use-a-long-random-maintainer-secret"
```

Restart `npm run dev` after changing `.env.local`.

If `ADMIN_SECRET` is missing locally, the admin tools remain unlocked for local
development. Deployed environments should always set it.

## Set The Secret In Vercel

1. Open the Sound City project in Vercel.
2. Go to Project Settings -> Environment Variables.
3. Add `ADMIN_SECRET`.
4. Use a long random value.
5. Enable it for Preview and Production.
6. Redeploy so the running app receives the new value.

## Use The Admin UI

1. Open `/admin`.
2. If the unlock form appears, paste the `ADMIN_SECRET` value into Admin secret.
3. Select Unlock admin.
4. Maintain catalog records normally.

The browser keeps the secret in `sessionStorage` for the current tab session and
sends it with Admin API requests. Closing the tab clears it.

## Use The Admin API

Send the secret as either `x-sound-city-admin-secret` or a Bearer token.

```bash
curl \
  -H "x-sound-city-admin-secret: use-a-long-random-maintainer-secret" \
  "https://your-preview-url.vercel.app/api/admin/catalog?city=chicago"
```

Bearer token form:

```bash
curl \
  -H "Authorization: Bearer use-a-long-random-maintainer-secret" \
  "https://your-preview-url.vercel.app/api/admin/catalog?city=chicago"
```

If the secret is missing or wrong, the API returns `401` with `Admin secret
required`.

## Rotation

1. Generate a new long random secret.
2. Replace `ADMIN_SECRET` in Vercel environment variables.
3. Redeploy the app.
4. Share the new value only with maintainers who need Admin access.
5. Update local `.env.local` files as needed.

