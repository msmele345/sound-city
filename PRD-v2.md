# Sound-City V2 PRD: Auto Refresh Review Queue

> Builds on `PRD.md` and the shipped v1 Admin CRUD workflow. V2 keeps Sound
> City Chicago-only and source-verified while reducing the manual work required
> to find upcoming events.

## Problem Statement

Sound City v1 can maintain real Chicago house and techno data, but refresh work
is fully manual. Maintainers must search Resident Advisor, venue calendars,
ticketing pages, and artist or social links, then hand-enter every event through
Admin CRUD. That protects data quality, but it does not scale well enough for a
weekly discovery product.

V2 should automate event discovery without weakening trust. The system should
find likely upcoming events, propose catalog changes, and route them through a
maintainer review queue before anything becomes public.

## Goals

- Find new upcoming Chicago events from configured source targets.
- Treat Resident Advisor and official venue calendars as co-primary sources.
- Use artist and social links as supporting evidence or enrichment when
  available.
- Create reviewable drafts instead of publishing automatically.
- Detect lightweight stale-event tasks, such as past events or broken source
  links.
- Preserve the existing `ADMIN_SECRET` security model for v2 MVP.
- Make review decisions auditable so future refresh runs can learn from accepted
  and rejected suggestions.
- Preserve the industrial warehouse design system described in
  `docs/ux-redesign.md`.

## Non-Goals

- No direct auto-publish to the public catalog.
- No broad web crawling.
- No login, CAPTCHA, anti-bot bypass, or fragile JavaScript-only source
  automation.
- No full raw page snapshots unless a later legal or debugging need is explicit.
- No scheduled refresh in v2 MVP. Vercel Cron is the likely v2.1 scheduler.
- No full authentication system in v2 MVP.
- No multi-city expansion. V2 is Chicago-only.
- No user-submitted public event intake.

## Users

- **Maintainer/admin**: Configures trusted source targets, runs refresh, reviews
  proposed changes, approves/rejects drafts, and monitors source health.
- **Public listener**: Sees fresher events and simple trust signals without
  seeing parser internals or confidence mechanics.

## User Stories

1. As an admin, I want to configure source owners and source targets, so that
   refresh runs know which Resident Advisor pages, venue calendars, and artist
   links are trusted.
2. As an admin, I want to manually run a refresh, so that I can find upcoming
   events on demand before scheduled automation exists.
3. As an admin, I want refresh runs to create review items, so that automation
   never publishes unreviewed event data.
4. As an admin, I want review lanes for new events, proposed updates, possible
   duplicates, stale tasks, and source health, so that each kind of work is easy
   to scan.
5. As an admin, I want new event drafts to include linked draft artists or
   venues when needed, so that dependent records can be approved together.
6. As an admin, I want existing-event updates to show field-level diffs, so that
   I can accept one correction without accepting unrelated parser guesses.
7. As an admin, I want major conflicts shown side by side, so that source
   disagreements do not get silently resolved.
8. As an admin, I want to reject items with a lightweight reason, so that source
   quality and parser behavior can improve over time.
9. As an admin, I want accepted and rejected review items moved to filterable
   history, so that catalog changes remain auditable.
10. As a public listener, I want event cards to show simple freshness and source
   trust signals, so that I can trust the event without reading admin details.

## Core Product Decisions

### Review-First Refresh

Automation proposes changes; admins publish them. A trusted single source can
create a draft, but confidence is higher when multiple sources agree. Source
confidence and freshness may later influence recommendation ranking as soft
signals, but they should not overpower taste match or discovery value.

### Source Model

Source targets are maintained in the Admin UI as database records, grouped by
source owner or entity. Examples include `Resident Advisor Chicago`, `smartbar`,
`Podlasie Club`, or `Artist: Lemtom`.

Each source target should capture:

- Owner/entity
- City, fixed to Chicago for v2
- Source type: Resident Advisor, official venue calendar, artist/social, or
  ticketing/supporting source
- URL
- Parser strategy
- Trust level
- Enabled/disabled status
- Refresh cadence preference for future scheduling
- Notes

### Event Discovery

V2 MVP starts with finding new upcoming events. Lightweight stale detection is a
secondary pass. Stale checks should create review tasks only; they should not
delete or archive records automatically.

### Matching And Duplicates

When a possible match exists, the system should prefer proposed updates over
separate drafts. Matching should consider venue, date/time window, normalized
title, and normalized artists. Low-confidence matches should become possible
duplicate review items.

### Review Behavior

- New event drafts are approved as whole records, with admin edits allowed
  before publishing.
- Updates to existing events support field-level approval.
- Unknown artists or venues are linked drafts inside the same review item.
- Whole-event approval publishes linked venue/artist drafts first, then the
  event, as a single all-or-nothing operation.
- Major conflicts such as start time, venue, lineup, ticket URL, age policy, or
  cancellation status require admin choice.
- Minor text differences may normalize quietly.
- Auto-enrichment is allowed only inside the draft/review item.

### Evidence Storage

Review items should store normalized fields, source URLs, fetch timestamp,
parser version, confidence details, and compact evidence excerpts or hashes.
They should not store full raw fetched content by default.

### Decision History

Accepted and rejected review items move to a filterable history view. Rejection
requires one lightweight reason from a small set, with optional notes.

Suggested rejection reasons:

- Duplicate
- Untrusted source
- Bad parse
- Not relevant
- Already stale
- Wrong city
- Other

Source targets should degrade in confidence automatically when they repeatedly
produce parser failures, duplicate drafts, or rejected suggestions. Admin action
is required to disable a source target.

### Refresh Runs

The Admin UI should expose a `Run refresh` action. V2 MVP may execute the run
immediately during the request, but the product model should still look
asynchronous: create a refresh run record, show pending/running/succeeded/failed
status, store logs/errors, and populate review lanes afterward.

Vercel Cron should be named as the likely v2.1 scheduler, with the refresh
engine callable from both an admin-triggered route and a future scheduled route.

## Security And Admin Secret

V2 MVP should use the existing `ADMIN_SECRET` model.

- Local maintainers set `ADMIN_SECRET` in `.env.local`.
- Vercel preview and production environments set `ADMIN_SECRET` as a project
  environment variable.
- Admin UI unlock stores the secret in session storage for the active browser
  session.
- Admin API calls send the secret through `x-sound-city-admin-secret`.
- Bearer token support may continue for direct API calls.
- Refresh-run triggering uses the same `ADMIN_SECRET` as Admin CRUD.
- `reviewedBy` and `triggeredBy` fields should be nullable and future-ready.
  They may be empty or use a simple value such as `admin-secret` until full auth
  exists.

Full authentication is valuable but out of scope for v2 MVP.

## UX Requirements

The review UI must follow `docs/ux-redesign.md`.

- Use the industrial warehouse system: concrete neutrals, square structure,
  dense information, and rule-based hierarchy.
- Use the single amber signal color only for status/focus/priority signals.
- Do not introduce cards, nested cards, glows, glassmorphism, drop shadows,
  gradient text, or multiple accent colors.
- Use `Anton` for display headings, `Archivo` for body/UI, and `IBM Plex Mono`
  for timestamps, run IDs, confidence values, source labels, and status data.
- Prefer a hybrid review layout: separated lanes with dense rule-separated rows,
  not kanban cards.
- Public-facing freshness signals should be simple: source count, last verified
  or updated date, and source links. Do not expose parser names, internal
  confidence scores, or ingestion status to public users.

## Metrics

V2 should track:

- Source coverage per refresh run
- Admin approval rate
- Draft count
- Proposed update count
- Stale task count
- Parser failure count
- Source degradation status
- Time from draft creation to approval/rejection

Source coverage and approval rate are the primary health metrics.

## V2 MVP Acceptance Criteria

- [ ] Admins can create, edit, enable, disable, and group Chicago source targets.
- [ ] Source targets support Resident Advisor, official venue calendar, and
      artist/social supporting-source types.
- [ ] Admins can manually trigger a refresh with `ADMIN_SECRET` protection.
- [ ] Refresh runs create durable run records with status, metrics, and errors.
- [ ] A dev-only parser strategy can generate fixture review items locally and
      in tests.
- [ ] The dev-only parser is hidden in production UI and rejected by server
      validation in production.
- [ ] New event drafts appear in a review lane and publish only after admin
      approval.
- [ ] Existing-event updates show clear field diffs with field-level acceptance.
- [ ] Possible duplicates are separated from high-confidence new drafts.
- [ ] Stale tasks are created but never auto-archived or auto-deleted.
- [ ] Linked artist and venue drafts publish with event approval as one
      all-or-nothing operation.
- [ ] Rejected items require a reason and move to filterable history.
- [ ] Approved items publish through existing catalog operations wherever
      possible.
- [ ] Source target confidence degrades after repeated bad outcomes and surfaces
      health warnings.
- [ ] Public event surfaces can use freshness/source confidence as soft ranking
      inputs and simple trust signals.
- [ ] The Admin review UI follows the industrial warehouse design invariants.

## V2.1 Candidate Acceptance Criteria

- [ ] Vercel Cron triggers the same refresh engine used by manual refresh.
- [ ] Scheduled routes have explicit protection suitable for automated calls.
- [ ] Refresh cadence can vary by source target.
- [ ] Scheduler failures are visible in Admin source health.

## Open Questions

- Which real Resident Advisor source target should be implemented first?
- Which official venue calendar should be implemented first?
- Should cancellation status become a first-class event field in v2 or remain a
  review-only conflict signal until later?
- Should archived/past event retention be modeled before stale tasks can propose
  deletion?
