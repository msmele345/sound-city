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
- `parserStrategy`: `resident-advisor`, `venue-calendar`, `artist-social`,
  `dev-static`
- `trustLevel`: `primary`, `supporting`, `experimental`
- `enabled`
- `confidenceAdjustment`
- `healthStatus`: `healthy`, `degraded`, `failing`, `disabled`
- `refreshCadence`
- `lastFetchedAt`
- `lastSuccessfulRunAt`
- `lastFailureAt`
- `lastFailureReason`
- `notes`
- `createdAt`
- `updatedAt`

Production must reject `parserStrategy: "dev-static"`. The Admin UI should also
hide it outside local/test environments.

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
- `approvalRateSnapshot`
- `errorSummary`
- `createdAt`

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
- `status`: `pending`, `approved`, `rejected`, `needs-info`, `expired`
- `priority`
- `confidence`
- `confidenceReasons`
- `targetEntityType`: `event`, `venue`, `artist`, `source-target`
- `targetEntityId`
- `matchFingerprint`
- `normalizedDraft`
- `fieldDiffs`
- `linkedDrafts`
- `conflicts`
- `evidence`
- `parserVersion`
- `fetchTimestamp`
- `reviewedBy`
- `reviewedAt`
- `rejectionReason`
- `reviewNotes`
- `publishedEntityId`
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
4. Engine marks the run `running`.
5. Engine loads enabled Chicago source targets.
6. Engine fetches each target that can be fetched reliably without auth,
   CAPTCHA, or fragile anti-bot behavior.
7. Parser emits candidates and compact evidence.
8. Matcher compares candidates against existing catalog events.
9. Engine creates review items:
   - New event
   - Proposed update
   - Possible duplicate
   - Stale task
   - Source health warning
10. Engine records metrics, logs, failures, and final run status.
11. Admin UI refreshes review lanes and run history.

For v2 MVP, steps 4-10 may execute immediately in the request. The data model
and UI should still support asynchronous status.

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
- Publishing should call existing catalog operations wherever possible.
- If validation fails, the review item remains unpublished and stores a clear
  error.

The current catalog store does not expose explicit transaction boundaries.
Drizzle-backed publishing will need a transaction-capable path for all-or-nothing
linked draft approval.

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

Public surfaces may show simple trust signals:

- Last verified/updated date
- Source count
- Source links
- Possibly `Updated from 2 sources`

Public surfaces should not expose parser strategy, internal confidence score,
review status, or ingestion errors.

Recommendation ranking can use source confidence and freshness as soft
tie-breakers. Taste match and discovery value remain primary.

## Source Health

Source target confidence should degrade automatically when a target repeatedly
produces:

- Parser failures
- Broken fetches
- Rejected review items
- Duplicate candidates
- Low approval rate

The system may mark targets as degraded and surface warnings, but only admins
can disable a target.

## Implementation Phases

### Phase 1: Schema And Store Foundation

Add Drizzle schema, migrations, types, and store operations for source owners,
source targets, refresh runs, run logs, review items, and decision history.

Acceptance criteria:

- [ ] Drizzle schema models v2 refresh concepts.
- [ ] Migrations can run against Neon.
- [ ] Store operations are covered by focused tests.
- [ ] `dev-static` parser strategy is rejected in production validation.
- [ ] Existing catalog read/write behavior remains unchanged.

### Phase 2: Source Target Admin

Add Admin UI and API support for grouped source owners and source targets.

Acceptance criteria:

- [ ] Admins can create, edit, enable, disable, and inspect source targets.
- [ ] Targets are grouped by owner/entity.
- [ ] Resident Advisor, official venue calendar, and artist/social target types
      are supported.
- [ ] The UI hides `dev-static` outside local/test environments.
- [ ] Routes use `ADMIN_SECRET` protection.

### Phase 3: Dev Parser Tracer Bullet

Build a dev-only parser strategy and refresh engine path that creates review
items from fixture data.

Acceptance criteria:

- [ ] Admins can run refresh manually.
- [ ] A refresh run record is created with status and metrics.
- [ ] Dev parser creates new event, proposed update, possible duplicate, and
      stale task examples.
- [ ] Review lanes populate from durable review items.
- [ ] Run logs and errors are visible in Admin.

### Phase 4: Review Queue And Publishing

Build review lanes, history, approval, rejection, and publishing.

Acceptance criteria:

- [ ] New event drafts can be edited and approved as whole records.
- [ ] Existing-event updates support field-level approval.
- [ ] Linked artist/venue drafts publish with event approval all-or-nothing.
- [ ] Rejections require a reason and optional notes.
- [ ] Approved/rejected items move to filterable history.
- [ ] Publishing reuses catalog operations wherever possible.

### Phase 5: Stale Tasks And Source Health

Add stale-event task generation and source health scoring.

Acceptance criteria:

- [ ] Past events or broken source links create stale tasks.
- [ ] Stale tasks never auto-delete or auto-archive catalog records.
- [ ] Source targets degrade after repeated bad outcomes.
- [ ] Admins see source coverage and approval-rate metrics.

### Phase 6: First Real Parsers

Add one real Resident Advisor target and one real official venue calendar target
after the queue workflow is proven with the dev parser.

Acceptance criteria:

- [ ] One RA parser can create review items from a configured target.
- [ ] One official venue calendar parser can create review items from a
      configured target.
- [ ] Sources that need login, CAPTCHA, or fragile JavaScript rendering are
      skipped or degraded.
- [ ] Parser output stores normalized fields, source URLs, fetch timestamp,
      parser version, and compact evidence.

### Phase 7: Public Trust Signals And Ranking Inputs

Expose simple freshness/source signals publicly and feed confidence/freshness
into recommendations as soft inputs.

Acceptance criteria:

- [ ] Public event surfaces show simple freshness/source signals.
- [ ] Public UI does not expose parser internals.
- [ ] Recommendation ranking can use confidence/freshness as tie-breakers.
- [ ] Taste match and discovery-first scoring remain primary.

### Phase 8: V2.1 Scheduler

Wire the refresh engine to Vercel Cron after manual refresh and review behavior
are stable.

Acceptance criteria:

- [ ] Vercel Cron calls the same refresh engine as manual refresh.
- [ ] Scheduled route has explicit protection.
- [ ] Scheduled run failures appear in Admin source health.
- [ ] Source cadence can be configured per target.

## Testing Strategy

- Unit test parser contracts, duplicate matching, confidence scoring, and stale
  task rules.
- Integration test Admin API routes with `ADMIN_SECRET`.
- Integration test publishing through catalog operations.
- Component test review lanes, field diffs, rejection reasons, and history.
- Keep the dev parser available in tests to exercise the full workflow without
  network dependency.
- Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`
  before deployment.

## Risks

- External sources may change markup often.
- Source terms may limit allowed fetching or content retention.
- Duplicate matching may be noisy until real data tunes thresholds.
- Without true background jobs, long manual refreshes may hit request limits.
- Transaction support needs care so linked drafts do not partially publish.

## Recommended First Slice

Build the dev-static tracer bullet end to end:

1. Schema for source targets, refresh runs, and review items.
2. Admin-protected manual refresh route.
3. Dev-only parser fixture.
4. Review lanes showing fixture-generated items.
5. Approve/reject flow for one new event draft.

This proves the product spine before real RA or venue calendar parsing adds
source-specific complexity.
