# UX Redesign — Industrial Warehouse System

> **For future agents:** This redesign was **not part of the original MVP plan**
> (`plans/sound-city-mvp.md`). It was introduced after a design critique and
> then evolved across the public views ([issue #31](https://github.com/msmele345/sound-city/issues/31)).
> Read this before touching `src/components/dashboard/`, `src/app/globals.css`,
> or `src/app/layout.tsx` so you don't unknowingly revert the design language.

## Why this happened

The initial dashboard implementation was functional and accessible but was
textbook **"AI slop"**: dark mode with radial glow blooms, Inter, five random
neon-`300` accent colors, every section wrapped in a card (cards nested inside
cards), a hero-metric stat grid, generic drop shadows, and a hardcoded rainbow
gradient block. A design critique flagged that for a **Chicago underground
house/techno** audience this read like a generic SaaS analytics tool — it had
the wrong soul and would fail the target user's authenticity test.

A redesign direction was chosen deliberately (not guessed):

- **Aesthetic lane:** Industrial warehouse — concrete-and-steel functionalism.
- **Risk budget:** "Confident but legible" — a bold, distinctive frame around
  calm, instantly-scannable event data. This is a tool people use weekly to
  find events; the *data* must never become hard to read for the sake of style.

## The design system (preserve these invariants)

Tokens live in `src/app/globals.css` under `@theme`. Use the token utilities
(`bg-bg`, `text-ink`, `border-rule`, `text-signal`, `font-display`,
`font-mono`, `text-label`, `text-meta`, `text-body`) — **do not** hardcode hex
values or reach for arbitrary Tailwind colors.

- **Palette:** near-monochrome, cold-tinted concrete neutrals (hue ~250),
  defined in OKLCH. Exactly **one** signal color: sodium-vapor hazard amber
  (`--color-signal`). It is reserved for match scores, the active nav item,
  section index tags, and focus rings. Adding a second accent color breaks the
  system.
- **Type:** `Anton` (condensed industrial signage — display/headings only),
  `Archivo` (engineered grotesque — body/UI), `IBM Plex Mono` (data: times,
  match scores, labels). The monospace is **intentional** (spec-sheet concept),
  not a lazy default — keep it for labels and data, not prose. Fonts are loaded
  via `next/font/google` in `src/app/layout.tsx`. A **12px type floor** applies:
  `--text-label` is 12px, `--text-meta` is 13px, and `--text-body` is 16px.
  Uppercase mono is for labels and data only (dates, times, scores, counts).
  Venue signal values, recommendation reasons, bios, and source names use
  sentence-case sans.
- **Layout:** **No cards.** Hierarchy comes from structural rules
  (`border-rule` / `border-rule-strong`), scale contrast, and value — not
  containers or shadows. Square corners, no drop shadows, no glassmorphism, no
  glow. Desktop layout is decided first; phones get one column.
- **Routes:** five public views under one shell (`PublicShell`): **For You**
  (`/`), **Events** (`/events`), **Artists** (`/artists`), **Venues**
  (`/venues`), and **Saved** (`/saved`). The home side column also has **Next
  up** and the weekly **Artist Showcase**. Section headings may be renamed;
  the names above are the current contract, covered by
  `dashboard-shell.test.tsx`. Admin is a footer link, not a nav item.
- **Shared primitives:** `Button` (quiet and pressed), `Chip`, `SegmentedControl`,
  `SectionMark`, and `EventRow` (recommendation, feed, compact, and saved).
  Loading lists use `LoadingRows` (skeleton geometry plus a screen-reader
  status). Failures use `LoadError` with Retry. Taste controls sit behind the
  Tune disclosure. Style options stay checkboxes; vibe, venue size, and start
  time are radio groups.
- **Motion:** the page-load `rise` stays (transform/opacity only, ease-out-expo,
  staggered). Small interaction feedback is also allowed: a press on buttons,
  a confirm on Save, and a row exit on Dismiss. Those use transform and opacity
  only, stay under 200ms, and are disabled under `prefers-reduced-motion`.
  Don't add scattered micro-animations or animate layout properties.
- **Accessibility:** `<main id="content">` is the skip-link target. Route
  changes move focus to that view's heading. The match meter keeps `sr-only`
  text so the score survives without color. Faint text stays at least 4.5:1
  on both background tokens. Buttons, chips, and segmented options keep a 36px
  pointer target and a 44px touch target.

### Hard "do not reintroduce" list

Inter / system fonts · dark-glow gradients · multiple neon accents · cards or
nested cards · the hero-metric stat-grid template · generic drop shadows ·
glassmorphism · gradient text · decorative rainbow gradients · eyebrow kickers
that merely restate the heading.

## What changed after the first redesign

The optional follow-ups from the first pass are done. The list below is the
record of those rules, not a backlog:

- Navigation is real routes, with the current page marked and a sticky bar.
  The large wordmark is home only.
- Every event row can be saved, dismissed, or marked attended. Dismiss can be
  undone. Saved events have their own view.
- Loading lists are skeleton rows that match the loaded geometry, and a
  screen-reader status still announces loading. An empty night says "Nothing
  on tonight" and links to the next date that has events. A failed fetch has
  Retry.
- Match scores read as percentages. Sources use a short site name. Reasons are
  plain sentences. The feed is grouped by day, with Tonight and Tomorrow labels.

When extending the UI, match this system. If a change would touch the design
language, re-read this file and the critique rationale first.
