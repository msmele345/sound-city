# UX Redesign — Industrial Warehouse System

> **For future agents:** This redesign was **not part of the original MVP plan**
> (`plans/sound-city-mvp.md`). It was introduced after a design critique. Read
> this before touching `src/components/dashboard-shell.tsx`,
> `src/app/globals.css`, or `src/app/layout.tsx` so you don't unknowingly revert
> the design language back to where it started.

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
`font-mono`, etc.) — **do not** hardcode hex values or reach for arbitrary
Tailwind colors.

- **Palette:** near-monochrome, cold-tinted concrete neutrals (hue ~250),
  defined in OKLCH. Exactly **one** signal color: sodium-vapor hazard amber
  (`--color-signal`). It is reserved for match scores, the active nav item,
  section index tags, and focus rings. Adding a second accent color breaks the
  system.
- **Type:** `Anton` (condensed industrial signage — display/headings only),
  `Archivo` (engineered grotesque — body/UI), `IBM Plex Mono` (data: times,
  match scores, labels). The monospace is **intentional** (spec-sheet concept),
  not a lazy default — keep it for data, not prose. Fonts are loaded via
  `next/font/google` in `src/app/layout.tsx`.
- **Layout:** **No cards.** Hierarchy comes from structural rules
  (`border-rule` / `border-rule-strong`), scale contrast, and value — not
  containers or shadows. Square corners, no drop shadows, no glassmorphism, no
  glow.
- **Motion:** one orchestrated page-load `rise` (transform/opacity only,
  ease-out-expo, staggered). `prefers-reduced-motion` is honored. Don't add
  scattered micro-animations or animate layout properties.
- **Accessibility:** the `<main>` landmark, ARIA-labelled sections, and the
  five section heading names (`Sound City`, `Recommended Tonight`,
  `Latest Events`, `Artist Showcase`, `Venue Signals`) are contract — the test
  in `dashboard-shell.test.tsx` depends on them. The match meter has `sr-only`
  text so meaning survives without color. Keep these.

### Hard "do not reintroduce" list

Inter / system fonts · dark-glow gradients · multiple neon accents · cards or
nested cards · the hero-metric stat-grid template · generic drop shadows ·
glassmorphism · gradient text · decorative rainbow gradients · eyebrow kickers
that merely restate the heading.

## Optional next steps (continuous UX improvement)

These are **not required** and not yet started. Ordered roughly by leverage:

1. **Close the actionability gap (product, highest value):** the dashboard is
   read-only. Event rows aren't links and there's no primary action
   (save / going / listen / view sources). A discovery tool you can't act on is
   a dead end. This needs design + product, not just styling.
2. **Fix navigation:** nav anchors point at `#dashboard`, `#events`, etc.
   which don't exist as targets. Wire to real routes/sections.
3. **`/impeccable:clarify`** — tighten remaining microcopy into the terse
   "manifest" voice the redesign established.
4. **Real states** — design empty / loading / error states for the event
   lists (currently static arrays). The critical one is "no events tonight,"
   the defining empty state for a discovery app.
5. **`/impeccable:polish`** — run *after* 1–4, once layout is stable, for the
   final spacing/alignment/detail pass.
6. **`/impeccable:audit`** — verify WCAG contrast on real data and across
   breakpoints once content is dynamic.

When extending the UI (new components, pages), match this system rather than
defaulting to generic patterns. If a change would touch the design language,
re-read this file and the critique rationale first.
