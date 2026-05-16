# Plan: Sound-City MVP

> Source PRD: `PRD.md`

## Architectural Decisions

- **App framework**: Next.js, React 19, TypeScript, and Tailwind.
- **Backend**: Next.js route handlers and server-side code deployed on Vercel.
- **Database**: Neon Postgres with Drizzle ORM.
- **Authentication**: None in v1.
- **Personalization**: Browser local storage for taste profile, saved events, dismissed events, and attended events.
- **Admin tooling**: Lightweight Admin CRUD screens are included in the initial MVP for curated catalog maintenance.
- **Primary city**: Chicago only in the UI, with city-aware schema and API design for future expansion.
- **Data source policy**: Real manually verified public data with source URLs and last verified timestamps.
- **Recommendation posture**: Discovery-first ranking that favors lesser-known events, venues, and artists while respecting user taste.

---

## Phase 1: Project Foundation

**User stories**: 19, 20, 21

### What to Build

Create the base Next.js app structure and visual system for Sound-City. The first screen should be an app dashboard, not a landing page. Establish the dark neon-flyer-wall direction with compact navigation, strong contrast, responsive layout primitives, and placeholder regions for recommendations, latest events, artist showcase, and venue discovery.

### Acceptance Criteria

- [x] A Next.js React 19 TypeScript app is created.
- [x] Tailwind is configured and used for styling.
- [x] The app has a dashboard-style first screen.
- [x] The visual direction is dark, vibrant, and poster-inspired without generic cyberpunk styling.
- [x] The layout works at mobile and desktop widths.
- [x] Basic build and typecheck scripts are available.

---

## Phase 2: Real Data Catalog

**User stories**: 10, 22, 25, 26

### What to Build

Add the persistent catalog foundation for cities, venues, artists, events, artist links, curated venue signals, and source provenance. Create the database schema, migration workflow, seed workflow, and read APIs needed for the rest of the app. Seed a focused launch dataset of real Chicago records from verified public sources and prepare the server-side catalog operations needed by Admin CRUD screens.

### Acceptance Criteria

- [ ] Neon Postgres connection is configured for local and Vercel environments.
- [ ] Drizzle schema and migrations are added.
- [ ] Seed data includes Chicago events, venues, artists, listening links, and source metadata.
- [ ] Real records include source URLs and last verified timestamps where applicable.
- [ ] Next.js route handlers can return city-scoped events, venues, artists, and showcase data.
- [ ] Server-side create, update, and delete operations are available for core catalog records.
- [ ] A manual data refresh process is documented.

---

## Phase 3: Event Discovery Feed

**User stories**: 1, 9, 10, 20, 21

### What to Build

Build the latest events feed as a complete discovery path from database to API to UI. Users should be able to scan upcoming Chicago house and techno events, compare core details, and open public source links to verify or buy tickets.

### Acceptance Criteria

- [ ] Upcoming Chicago events are loaded from the API.
- [ ] Event cards show date, time, venue, neighborhood, artists, styles, and source information.
- [ ] Events can be filtered or grouped by useful discovery dimensions such as date, style, or neighborhood.
- [ ] Empty, loading, and error states are handled.
- [ ] Event source links are visible and usable.
- [ ] The feed remains readable on mobile and desktop.

---

## Phase 4: Local Taste Profile And Recommendations

**User stories**: 2, 3, 4, 5, 6, 7, 8

### What to Build

Build the core recommendation experience. Users can tune their taste profile, save events, dismiss events, and mark events as attended. The app uses those local signals to rank events with a discovery-first scoring model that surfaces underground or less obvious options.

### Acceptance Criteria

- [ ] Taste profile settings are stored locally in the browser.
- [ ] Users can set style, vibe, venue size, start time, and discovery-level preferences.
- [ ] Users can save, dismiss, and mark events as attended.
- [ ] Saved, dismissed, and attended states persist across page reloads.
- [ ] Recommended events update when preferences or actions change.
- [ ] Recommendations explain the main reason an event was suggested.
- [ ] Recommendation scoring has unit test coverage.

---

## Phase 5: Artist Showcase And Venue Directory

**User stories**: 11, 12, 13, 14, 15, 16, 17, 18

### What to Build

Add the weekly artist showcase and venue directory. The artist showcase should highlight a different house or techno artist with context, listening links, and upcoming shows. The venue directory should help users understand Chicago spaces that host house and techno events, including upcoming events and curated scene signals.

### Acceptance Criteria

- [ ] The weekly artist showcase loads from the API.
- [ ] Showcase content includes artist context, listening links, and upcoming events when available.
- [ ] Artist links open to curated external destinations.
- [ ] The venue directory lists Chicago venues that host house and techno events.
- [ ] Venue details include neighborhood, location context, upcoming events, and curated scene signals.
- [ ] Venue and artist sections work in responsive layouts.

---

## Phase 6: Admin CRUD

**User stories**: 23, 24, 25, 26

### What to Build

Add lightweight Admin CRUD screens for maintaining the curated catalog. Admin screens should support city-aware management of venues, artists, events, artist links, venue signals, and source provenance. Because v1 has no authentication, these screens are intended for controlled maintainer use during MVP development and preview deployment, not public self-service contribution.

### Acceptance Criteria

- [ ] Admin navigation is available for catalog maintenance workflows.
- [ ] Admin users can create, edit, and delete venues, artists, events, artist links, venue signals, and source metadata.
- [ ] Forms validate required fields, relationships, source URLs, and last verified dates.
- [ ] Admin lists support quick scanning and editing of Chicago launch data.
- [ ] Mutations update Neon Postgres through typed Drizzle operations.
- [ ] Destructive actions require confirmation.
- [ ] Admin CRUD workflows have focused test coverage.

---

## Phase 7: Launch Polish And Deployment Readiness

**User stories**: 20, 21, 25, 26

### What to Build

Prepare the Next.js app for a Vercel preview deployment. Tighten visual polish, accessibility, responsive behavior, data refresh documentation, admin maintenance workflows, and verification scripts. Make sure the MVP is demoable as a working product with real Chicago data, local personalization, and maintainable curated records.

### Acceptance Criteria

- [ ] Build, typecheck, and test commands pass.
- [ ] Core flows are verified on mobile and desktop.
- [ ] Keyboard navigation and accessible labels are checked for primary controls.
- [ ] Loading, empty, and error states are polished.
- [ ] Vercel deployment configuration is documented.
- [ ] Environment variables required for Neon are documented.
- [ ] Manual data refresh instructions are complete enough for another maintainer to follow.
