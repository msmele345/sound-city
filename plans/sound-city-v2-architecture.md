# Plan: Sound-City V2 Auto Refresh Architecture

> Source PRD: `PRD-v2.md`

## Architecture Summary

V2 adds a review-first ingestion layer around the existing catalog. Source
targets define where to look. Refresh runs fetch and parse those targets.
Review items store normalized drafts, evidence, confidence, conflicts, and
history. Approved items publish through existing catalog operations whenever
possible.

The v2 MVP remains Chicago-only, manually triggered, and protected by
`ADMIN_SECRET`. Vercel Cron is the likely v2.1 scheduler, but the refresh engine
should be callable by both the Admin UI and a future scheduled route.

## Resolved Design Decisions

These three decisions shape the phases below and override looser language in the
PRD where they conflict.

1. **Multi-source lives on the review item only (not the public catalog).**
   The public catalog keeps one `sourceId` per record for v2 MVP. Multiple
   source URLs, evidence, and confidence-from-agreement live on the *review
   item* during review. On publish, the event collapses to a single canonical
   source (the highest-trust agreeing target). A true `event_sources`
   many-to-many join and the public "verified by N sources" badge are **deferred
   to v2.1** — they would ripple through both stores, the publish path, the
   public read API, and existing admin forms for the weakest-leverage promise in
   the PRD. Public trust signals in MVP are limited to last-verified date and a
   single source link.

2. **Venue calendars are the first real parser; Resident Advisor comes later.**
   ra.co is a JS SPA behind anti-bot protection, which collides with the
   "no fragile JavaScript-only automation" non-goal. Official venue calendars
   (often ICS or simple HTML) are the first real source. RA is a separate,
   later investigation (v2.1 candidate), and is downgraded from "co-primary" to
   "supporting/manual" until a non-fragile fetch path is proven. Parsers prefer
   structured feeds (ICS / JSON-LD / RSS / sitemap) over HTML wherever offered.

3. **Cancellation is a review-only conflict signal in v2.**
   Events get no cancellation field in v2 MVP. Cancellation surfaces to the
   admin as a review-item conflict note; it does not publish a public
   "cancelled" state. A first-class event status field is a later decision.

## Existing System To Reuse

- `src/app/api/admin/catalog/route.ts` for `ADMIN_SECRET` protection patterns.
- `src/server/catalog/operations.ts` for catalog validation and create/update
  behavior.
- `src/server/catalog/catalog-store.ts` and `drizzle-catalog-store.ts` for
  persistence patterns.
- `src/server/db/schema.ts` for Drizzle schema conventions.
- `src/components/admin-catalog.tsx` for current Admin unlock and mutation
  behavior.
- `docs/ux-redesign.md` for review UI design invariants.

## New Domain Concepts

### Source Owner

A source owner groups one or more source targets under a meaningful entity.
Examples: `Resident Advisor Chicago`, `smartbar`, `Podlasie Club`,
`Artist: Lemtom`.

Suggested fields:

- `id`
- `cityId`
- `name`
- `slug`
- `kind`: `listing-platform`, `venue`, `artist`, `promoter`, `ticketing`
- `notes`
- `createdAt`
- `updatedAt`

### Source Target

A source target is a configured URL that refresh runs can fetch.

Suggested fields:

- `id`
- `ownerId`
- `cityId`
- `url`
- `sourceType`: `resident-advisor`, `official-venue-calendar`,
  `artist-social`, `ticketing`, `other`
- `parserStrategy`: `venue-calendar`, `artist-social`, `resident-advisor`,
  `dev-static`
- `trustLevel`: `primary`, `supporting`, `experimental`
- `enabled`
- `confidenceAdjustment`
- `healthStatus`: `healthy`, `degraded`, `failing`, `disabled`
  (set **manually** in MVP; auto-degradation is deferred — see Source Health)
- `refreshCadence`
- `lastFetchedAt`
- `lastSuccessfulRunAt`
- `lastFailureAt`
- `lastFailureReason`
- `notes`
- `createdAt`
- `updatedAt`

`parserStrategy: "dev-static"` must be hidden in the Admin UI and rejected by
server validation **outside local/test environments**. Gate on
`VERCEL_ENV !== "production"` (or an explicit `ENABLE_DEV_PARSER` flag), **not**
`NODE_ENV` — Vercel preview deployments run with `NODE_ENV=production`, and
previews are exactly where the fixture workflow should be demoable.

### Refresh Run

A refresh run records a manual or future scheduled execution.

Suggested fields:

- `id`
- `cityId`
- `trigger`: `manual`, `scheduled`
- `status`: `pending`, `running`, `succeeded`, `failed`, `partial`
- `triggeredBy`
- `startedAt`
- `finishedAt`
- `sourceTargetsChecked`
- `sourceTargetsFailed`
- `draftsCreated`
- `updatesProposed`
- `duplicatesFlagged`
- `staleTasksCreated`
- `errorSummary`
- `createdAt`

Approval rate is **not** stored on the run. It is a lagging, cross-run metric
(a run's items are unreviewed when the run finishes), so it is computed as a
derived query over review items, not snapshotted here.

Runs must always reach a terminal status. Wrap the engine in `try/finally` so
status is written even on throw, and treat any run left in `running` past a
max duration as `failed`/`partial` when next read (orphaned-run reconciliation).

### Refresh Run Log

Run logs support Admin diagnostics without exposing internals publicly.

Suggested fields:

- `id`
- `runId`
- `sourceTargetId`
- `level`: `info`, `warning`, `error`
- `message`
- `metadata`
- `createdAt`

### Review Item

A review item is the unit shown in Admin lanes.

Suggested fields:

- `id`
- `cityId`
- `runId`
- `sourceTargetId`
- `lane`: `new-event`, `proposed-update`, `possible-duplicate`,
  `stale-task`, `source-health`
- `status`: `pending`, `approved`, `rejected`
  (`needs-info` / `expired` are optional future statuses, not MVP)
- `priority`
- `confidence`
- `confidenceReasons`
- `targetEntityType`: `event`, `venue`, `artist`, `source-target`
- `targetEntityId`
- `matchFingerprint`
- `normalizedDraft`
- `fieldDiffs`
- `linkedDrafts`
- `conflicts` (includes cancellation as a review-only note; not published)
- `evidence` (holds the **multiple** source URLs / excerpts / hashes that back
  this item — this is where multi-source corroboration lives)
- `parserVersion`
- `fetchTimestamp`
- `reviewedBy`
- `reviewedAt`
- `rejectionReason`
- `reviewNotes`
- `publishedEntityId`
- `publishedSourceId` (the single canonical source chosen at publish time)
- `createdAt`
- `updatedAt`

`normalizedDraft`, `fieldDiffs`, `linkedDrafts`, `conflicts`, and `evidence`
can begin as typed JSON columns and later be normalized if query needs demand
it.

### Review Decision History

Decision history may be represented by immutable review item state changes or a
separate table if audit needs grow.

Suggested fields for a separate table:

- `id`
- `reviewItemId`
- `decision`: `approved`, `rejected`, `edited`, `field-accepted`,
  `field-rejected`
- `fieldName`
- `reason`
- `notes`
- `reviewedBy`
- `createdAt`

## Parser Contract

Each parser strategy should implement a common contract:

```ts
type ParsedRefreshCandidate = {
  sourceTargetId: string;
  parserStrategy: string;
  parserVersion: string;
  fetchedAt: string;
  evidence: {
    sourceUrls: string[];
    excerpts: string[];
    contentHashes: string[];
  };
  events: ParsedEventCandidate[];
  sourceHealth?: ParsedSourceHealth;
};
```

Parsed event candidates should include normalized title, startsAt, venue,
artists, styles, ticket/source URLs, age policy, price, and optional flyer
metadata when available. Parsers should not publish. They only emit candidates.

## Refresh Engine Flow

1. Admin calls `Run refresh`.
2. API validates `ADMIN_SECRET`.
3. API creates a `refreshRun` with `pending` status.
4. Engine marks the run `running` (inside a `try/finally` that guarantees a
   terminal status on completion or throw).
5. Engine loads enabled Chicago source targets.
6. Engine fetches each target that can be fetched reliably without auth,
   CAPTCHA, or fragile anti-bot behavior. Prefer structured feeds.
7. Parser emits candidates and compact evidence.
8. Matcher compares candidates against existing catalog events, grouping
   candidates by `matchFingerprint`. When 2+ targets agree on the same
   fingerprint, the review item's confidence rises and all agreeing source URLs
   are attached to its `evidence` (this is multi-source corroboration, on the
   review item only).
9. Engine creates review items:
   - New event
   - Proposed update
   - Possible duplicate
   - Stale task (past-event only in MVP)
   - Source health warning
10. Engine records metrics, logs, failures, and final run status.
11. Admin UI refreshes review lanes and run history.

For v2 MVP, steps 4-10 may execute immediately in the request. Vercel's default
function timeout is now 300s, so this is viable for the dev parser and a small
number of real targets; the data model and UI still support asynchronous status
so a future job runner can take over.

## Matching Rules

Prefer proposed updates when a likely existing event match exists.

Initial matching signals:

- Same or equivalent venue
- Event time within a configurable window
- Normalized title similarity
- Artist overlap
- Shared source URLs

When confidence is low, create a `possible-duplicate` review item instead of a
clean new draft or update.

## Publishing Rules

- New event approval publishes the whole event draft after admin edits.
- Existing event updates support field-level acceptance.
- Linked new venue and artist drafts publish before the event in a single
  all-or-nothing operation.
- Publishing collapses the review item's multiple evidence sources to one
  canonical `sourceId` (highest-trust agreeing target) for the published record,
  consistent with the single-source public catalog decision.
- Publishing should call existing catalog operations wherever possible.
- If validation fails, the review item remains unpublished and stores a clear
  error.

The current catalog store does not expose explicit transaction boundaries.
All-or-nothing linked publishing requires a `withTransaction` path on the
Drizzle store; the in-memory seed store's transaction is best-effort (acceptable
for tests). This is required store work in Phase 4, not free reuse of existing
operations.

## API Surface

Suggested route handlers:

- `GET /api/admin/source-targets?city=chicago`
- `POST /api/admin/source-targets`
- `PATCH /api/admin/source-targets`
- `DELETE /api/admin/source-targets`
- `POST /api/admin/refresh-runs`
- `GET /api/admin/refresh-runs?city=chicago`
- `GET /api/admin/review-items?city=chicago&lane=new-event`
- `PATCH /api/admin/review-items/:id`
- `POST /api/admin/review-items/:id/approve`
- `POST /api/admin/review-items/:id/reject`

All Admin routes use the same `ADMIN_SECRET` validation as Admin CRUD.

For v2.1, add a scheduled route that calls the same refresh engine. It should
use Vercel Cron and route-level protection appropriate for scheduled execution.

## Admin UI Shape

Add Admin surfaces without breaking the current industrial warehouse system.

Recommended sections:

- Source Targets
- Refresh Runs
- Needs Review count
- New Events lane
- Proposed Updates lane
- Possible Duplicates lane
- Stale Tasks lane
- Source Health lane
- History

Use a hybrid layout: separated lanes with dense rule-separated rows. Avoid
kanban cards, floating panels, shadows, glows, and multiple accent colors.

## Public UI Touchpoints

Public surfaces show simple trust signals, single-source for v2 MVP:

- Last verified/updated date
- Source link

Deferred to v2.1 (require the `event_sources` join): source **count** and an
"Updated from N sources" badge.

Public surfaces should not expose parser strategy, internal confidence score,
review status, or ingestion errors.

Recommendation ranking can use source confidence and freshness as soft
tie-breakers. Taste match and discovery value remain primary.

## Searchable Techno Sub-Genres

Add `melodic`, `groovy`, `hard`, and `trance` as first-class, searchable techno
sub-genres alongside the existing free-form `styles` values.

- Treat these as canonical style tags on events and artists (the existing
  `styles: string[]` columns already hold them — no schema change required).
- Expose them in the public style filter (`src/components/dashboard-shell.tsx`)
  so users can narrow to a techno sub-genre, and in taste-profile style
  selection.
- Parsers and the review queue should normalize incoming style text to these
  canonical tags (e.g. "melodic techno" → `melodic`) so refreshed events are
  searchable under the same vocabulary as hand-entered ones.
- Keep the vocabulary open: these four are seeded canonical tags, not a closed
  enum. Free-form styles remain allowed; canonical tags just get reliable
  filtering and consistent labels.

Acceptance criteria:

- [ ] `melodic`, `groovy`, `hard`, and `trance` are selectable in the public
      style filter.
- [ ] Events/artists tagged with these styles are returned when filtering by
      them.
- [ ] Parser/review normalization maps common variants to the canonical tags.
- [ ] No catalog schema migration is required (reuses `styles`).

## Source Health

In v2 MVP, source health is **manual** plus raw counters:

- Track per-target counters: parser failures, broken fetches, rejected review
  items, duplicate candidates, and approval-rate inputs.
- Surface those counters and a manually-set `healthStatus` in the Source Health
  lane.

Automatic confidence degradation (a scoring/decay formula) is **deferred** until
real parsers produce enough signal to tune it — building it against fixtures
fits to noise. Only admins can disable a target in any case.

## Implementation Phases

### Phase 1: Schema And Store Foundation

Add Drizzle schema, migrations, types, and store operations for source owners,
source targets, refresh runs, run logs, review items, and decision history.
No `event_sources` join and no event cancellation field (both deferred per
Resolved Design Decisions).

Acceptance criteria:

- [ ] Drizzle schema models v2 refresh concepts.
- [ ] Migrations can run against Neon.
- [ ] Store operations are covered by focused tests.
- [ ] `dev-static` parser strategy is rejected when `VERCEL_ENV === "production"`.
- [ ] Existing catalog read/write behavior remains unchanged.

### Phase 2: Source Target Admin

Add Admin UI and API support for grouped source owners and source targets.

Acceptance criteria:

- [ ] Admins can create, edit, enable, disable, and inspect source targets.
- [ ] Targets are grouped by owner/entity.
- [ ] Venue calendar, artist/social, and (config-only) Resident Advisor target
      types are supported.
- [ ] The UI hides `dev-static` outside local/test (`VERCEL_ENV !== "production"`).
- [ ] Routes use `ADMIN_SECRET` protection.

### Phase 3: Dev Parser Tracer Bullet

Build a dev-only parser strategy and refresh engine path that creates review
items from fixture data.

Acceptance criteria:

- [x] Admins can run refresh manually.
- [x] A refresh run record is created with status and metrics.
- [x] The engine always reaches a terminal status (try/finally); orphaned
      `running` runs are reconciled on read.
- [x] Dev parser creates new event, proposed update, possible duplicate, and
      stale task examples.
- [x] Review lanes populate from durable review items.
- [x] Run logs and errors are visible in Admin.

### Phase 4: Review Queue And Publishing

Build review lanes, history, approval, rejection, and publishing. Add the
`withTransaction` path to the Drizzle store for all-or-nothing linked publishing.
This is the heaviest UI phase (two approval models: whole-record + field-level).

Acceptance criteria:

- [ ] New event drafts can be edited and approved as whole records.
- [ ] Existing-event updates support field-level approval.
- [ ] Linked artist/venue drafts publish with event approval all-or-nothing via
      a transaction.
- [ ] Publish collapses review-item evidence to one canonical `sourceId`.
- [ ] Rejections require a reason and optional notes.
- [ ] Approved/rejected items move to filterable history.
- [ ] Publishing reuses catalog operations wherever possible.

### Phase 5: Stale Tasks And Source Health

Add stale-event task generation (past-event only) and manual source health with
counters.

Acceptance criteria:

- [ ] Past events (`startsAt < now`) create stale tasks via a DB query — no
      network fetch required.
- [ ] Stale tasks never auto-delete or auto-archive catalog records.
- [ ] Per-target counters (failures, rejections, duplicates) are recorded and
      shown in the Source Health lane.
- [ ] Admins can manually set `healthStatus`.
- [ ] Admins see source coverage and (derived) approval-rate metrics.

Deferred to later: broken-link / link-rot detection (network probe per source)
and automatic confidence degradation.

### Phase 6: First Real Parser — Venue Calendar

Add one real official venue calendar target after the queue workflow is proven
with the dev parser. Prefer a structured feed (ICS) over HTML.

Acceptance criteria:

- [ ] One official venue calendar parser creates review items from a configured
      target.
- [ ] The parser prefers a structured feed (ICS/JSON-LD) when available.
- [ ] Sources that need login, CAPTCHA, or fragile JavaScript rendering are
      skipped or marked degraded rather than scraped fragilely.
- [ ] Parser output stores normalized fields, source URLs, fetch timestamp,
      parser version, and compact evidence.

### Phase 7: Public Trust Signals And Ranking Inputs

Expose simple single-source freshness signals publicly and feed
confidence/freshness into recommendations as soft inputs.

Acceptance criteria:

- [x] Public event surfaces show last-verified date and source link.
- [x] Public UI does not expose parser internals.
- [x] Recommendation ranking can use confidence/freshness as tie-breakers.
- [x] Taste match and discovery-first scoring remain primary.

(Public "source count" / multi-source badge is out of this phase; see v2.1.)


### Phase 8 (v2.1.0): RSS Event Feed Parser

Add an RSS parser strategy for official venue event feeds that expose structured
RSS/XML but not venue-wide ICS. This is a meaningful v2 admin-refresh constraint:
Smartbar exposes `https://smartbarchicago.com/events/feed/` with useful event
titles, source links, publication/update timestamps, and description text, but
does not expose a discoverable venue-wide `.ics` feed from the public events or
event-detail pages. The current `venue-calendar` parser rejects RSS because it
expects `text/calendar` or an `.ics` URL, so Smartbar-style sources are manual
evidence only until RSS is supported.

Recommended scope:

- Add `parserStrategy: "rss-event-feed"` and pair it with source type
  `official-venue-calendar` or `other` for venues whose official site publishes
  events through RSS.
- Fetch RSS/XML feeds and parse `<item>` records into review candidates.
- Prefer item `<link>` as the evidence/source URL; use item `<title>` as the
  draft title.
- Extract `startsAt` from common event-description patterns before falling back
  to `pubDate`. `pubDate` is usually the publish/update date, not the event
  date, so using it as the event start time would create bad catalog records.
- Preserve raw description excerpts as compact evidence so admins can verify
  date, time, artists, price, and age policy before approval.
- Treat ambiguous dates or missing event dates as `source-health` or
  low-confidence review items rather than publishing-ready `new-event` drafts.
- Keep RSS parsing review-first; do not auto-publish and do not scrape linked
  event pages in the first slice.

Effort estimate:

- **Small parser slice (1-2 days)**: add parser strategy validation, fetch
  XML, parse RSS items, create low-confidence `new-event` review items when a
  date can be extracted from the description, and add unit tests with Smartbar-
  shaped fixtures.
- **Useful production slice (3-5 days)**: add robust date/time extraction,
  HTML entity cleanup, duplicate fingerprinting, source-health handling for
  ambiguous items, Admin copy/status messages, and integration coverage through
  manual refresh.
- **Hardening slice (1+ week if needed)**: support multiple RSS variants
  (`content:encoded`, custom event fields, Atom), linked event-page enrichment,
  per-source parsing rules, and stronger duplicate/update matching.

Risks and constraints:

- RSS event feeds are less normalized than ICS. Event dates often live inside
  human-written descriptions, so parser confidence should start lower than
  `venue-calendar`.
- `pubDate` should not be trusted as `startsAt`; it often means "posted at" or
  "last updated."
- Venue names, artist names, styles, prices, and age policy may need admin edits
  after parsing.
- Some feeds may only include the most recently announced events, not the full
  upcoming calendar. Source health should make that visible rather than hiding
  it.

V2 Phase 8 acceptance criteria:

- [x] Admins can create an enabled RSS source target without using the
      `venue-calendar` parser.
- [x] A Smartbar-shaped RSS fixture creates review items with event title,
      candidate start date/time, source URL, parser version, and evidence
      excerpt.
- [x] Items with no reliable event date are flagged as low-confidence or source
      health issues instead of creating publish-ready drafts.
- [x] RSS parser failures update run logs and source-target failure counters.
- [x] Existing ICS `venue-calendar` behavior remains unchanged.

### Phase 9 (v2.2.0 candidates)

Deferred work, in rough priority order:

- **RA feasibility spike + parser**: determine whether ra.co exposes a usable
  structured feed; build the RA parser or keep RA as supporting/manual.
- **`event_sources` join + public source count**: true multi-source on the
  public catalog, with a defined freshness rule and source dedup.
- **Vercel Cron scheduler**: Cron calls the same refresh engine as manual
  refresh; scheduled route has explicit protection; scheduled failures appear in
  Admin source health; cadence configurable per target.
- **Automatic source-health degradation**: scoring/decay tuned on real data.
- **Link-rot detection**: network probe of existing source URLs for stale tasks.
- **Event cancellation as a first-class field** (if review-only proves
  insufficient).

## Testing Strategy

- Unit test parser contracts, duplicate matching, confidence scoring, and
  past-event stale rules.
- Integration test Admin API routes with `ADMIN_SECRET`.
- Integration test publishing through catalog operations, including transactional
  all-or-nothing linked drafts and canonical-source collapse.
- Component test review lanes, field diffs, rejection reasons, and history.
- Keep the dev parser available in tests to exercise the full workflow without
  network dependency.
- Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`
  before deployment.

## Risks

- External sources may change markup often (mitigated by preferring structured
  feeds and starting with venue calendars).
- Source terms may limit allowed fetching or content retention.
- Duplicate matching may be noisy until real data tunes thresholds.
- Synchronous refresh can orphan a run if the function dies mid-request
  (mitigated by try/finally + reconciliation).
- Transaction support needs care so linked drafts do not partially publish.

## Recommended First Slice

Build the dev-static tracer bullet end to end:

1. Schema for source targets, refresh runs, and review items.
2. Admin-protected manual refresh route.
3. Dev-only parser fixture.
4. Review lanes showing fixture-generated items.
5. Approve/reject flow for one new event draft.

This proves the product spine before real venue calendar parsing adds
source-specific complexity, and well before RA or multi-source is attempted.
