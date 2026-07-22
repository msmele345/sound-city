# Plan: Phase 9 Scheduled Refresh Reliability And Parser Hardening

> Source PRD: [Phase 9 scheduled refresh spec](./phase-9-scheduled-refresh-spec.md) and [GitHub issue #18](https://github.com/msmele345/sound-city/issues/18)

## Architectural decisions

- **Release guarantee**: Phase 9 delivers reliable daily refresh for certified existing ICS and RSS sources. A production Resident Advisor parser is not required for release.
- **Certified source matrix**: Smartbar RSS, Radius RSS, and one relevant official Chicago ICS subscription feed. These sources define certification coverage but are not hardcoded into scheduling logic.
- **Review-first boundary**: Scheduled ingestion creates or updates review work and never publishes catalog changes automatically.
- **Routes**: Manual refresh remains behind the Admin API and `ADMIN_SECRET`. Scheduled refresh uses `GET /api/cron/refresh` with a separate mandatory `CRON_SECRET` Bearer token.
- **Scheduling**: One production Vercel Cron invocation runs daily. Enabled targets with `daily` cadence are eligible; enabled targets with `manual` cadence remain manually runnable. Custom per-target schedules are deferred.
- **Execution model**: Manual and scheduled requests call one generalized refresh engine with explicit trigger and target-selection policies. The Phase 9 matrix runs synchronously.
- **Single flight**: A database-backed per-city lease permits only one active refresh. Scheduled overlap records a skipped run; manual overlap returns the active run identifier.
- **Run model**: Run status supports `pending`, `running`, `succeeded`, `partial`, `failed`, and `skipped`. A run is partial when some targets fail and others complete successfully.
- **Target outcome model**: One durable outcome per run and source target records status, timestamps, counts, warnings, errors, and request telemetry. Logs remain diagnostic rather than serving as the reporting model.
- **Observation model**: Durable source-event observations are unique by source target and source event key. They retain the latest match fingerprint, material hash, compact normalized candidate, timestamps, workflow references, and parser version.
- **Identity model**: Source event key identifies an item within one source; match fingerprint supports cross-source comparison; content hash detects normalized material changes.
- **Material changes**: Catalog-relevant fields affect the material hash. Evidence formatting, publication timestamps, tracking parameters, fetch timestamps, and parser version alone do not reopen review work.
- **Fetch boundary**: Production fetches are public HTTPS only, with bounded redirects, timeout, response size, retries, address safety, conditional requests, and compact telemetry.
- **Parser boundary**: Parser support is fixture-certified against named sources. Malformed items are isolated where the document remains usable. Broader format compatibility is added only when a certified source requires it.
- **Source health**: Operational health is derived from recent outcomes with deterministic thresholds and recovery hysteresis. It never disables a target or changes trust/confidence automatically.
- **Stale detection**: Scheduled runs retain the existing review-only past-event stale-task stage.
- **RA boundary**: Resident Advisor receives a one-working-day feasibility spike. Browser automation, authentication, CAPTCHA handling, session workarounds, and anti-bot circumvention remain prohibited.
- **Testing strategy**: Use red-green-refactor. Refresh-engine integration is the primary seam, supported by parser fixtures, persistence constraints, route behavior, Admin rendering, and manual source certification.

---

## Phase 1: Idempotent Manual-Refresh Tracer

**User stories**: 3–7, 28

### What to build

Extend the parser candidate contract with stable source identity and normalized material hashes, then persist source-event observations through the existing manual refresh workflow. Use a controlled parser fixture to prove the complete lifecycle: first sighting creates review work, an unchanged sighting creates nothing, and a material change updates or reopens the correct workflow artifact based on its current state. Keep evidence-only changes visible without treating them as review work.

### Acceptance criteria

- [x] Source event key, cross-source match fingerprint, and material content hash are distinct fields with documented semantics.
- [x] Source-event observations are durable and unique by source target plus source event key.
- [x] A first observation creates the expected review item and links the observation to it.
- [x] An immediate unchanged repeat creates no new review item and records the observation as seen again.
- [x] A material change updates the existing pending review item instead of creating a competing draft.
- [x] A material change after publication creates a field-level proposed update linked to the published event.
- [x] A rejected observation remains suppressed until its material hash changes.
- [x] Evidence-only changes do not reopen review work.
- [x] Observation classification and review-item writes are atomic under concurrent attempts.
- [x] Parser-version changes alone do not flood the review queue.
- [x] Engine integration tests demonstrate the complete behavior through the manual refresh seam.

---

## Phase 2: First-Class Target Outcomes And Operational Health

**User stories**: 8–12, 19–21

### What to build

Persist one structured outcome for every target attempted during a refresh, aggregate those outcomes into the durable run result, and show the source-level result in Admin. Use the outcomes to derive operational health and recovery without changing source trust, confidence, or enablement. Isolate malformed event items so valid siblings can still reach review.

### Acceptance criteria

- [x] Each attempted target receives one outcome unique to its run and target.
- [x] Outcomes record status, start/finish timestamps, candidate counts, created/updated/unchanged counts, warning count, error details, and request telemetry.
- [x] Target outcome status supports `running`, `succeeded`, `failed`, `skipped`, and `unchanged`.
- [x] Run status is `succeeded` when all attempted targets succeed or are unchanged, `partial` when outcomes are mixed, and `failed` when all attempted targets fail.
- [ ] Admin summarizes partial results in source terms, such as “2 of 3 sources succeeded.”
- [ ] Admin exposes the failed target and compact error without requiring log inspection.
- [ ] Valid feed items are retained when sibling items are malformed.
- [ ] Repeated malformed items do not create duplicate persistent warnings.
- [ ] One failure produces a warning, two consecutive failures derive `degraded`, and four derive `failing`.
- [ ] One success moves `failing` to `degraded`; two consecutive successes restore `healthy`.
- [ ] Successful unchanged outcomes count as successes; skipped outcomes do not affect health.
- [ ] Derived health never disables a target or changes trust/confidence settings.
- [ ] Engine, persistence, API, and Admin tests cover target outcomes and health transitions end to end.

---

## Phase 3: Single-Flight Refresh Execution

**User stories**: 13–15

### What to build

Protect the generalized refresh workflow with a database-backed Chicago lease. Make overlap behavior explicit for both triggers: Cron records an explainable skipped attempt, while Admin receives the active run and does not begin a competing refresh. Reuse the established orphan threshold to recover abandoned execution safely.

### Acceptance criteria

- [ ] Lease acquisition is atomic across concurrent application instances.
- [ ] Only one active refresh can hold the Chicago lease.
- [ ] A scheduled overlap creates a terminal skipped run linked to the active run and performs no source fetches.
- [ ] A manual overlap returns `409 Conflict` with the active run identifier and performs no source fetches.
- [ ] Admin presents an active-run message instead of a generic refresh failure.
- [ ] A lease older than the orphan threshold can be reconciled and reacquired safely.
- [ ] Every acquired lease is released after successful, partial, failed, or exceptional completion.
- [ ] Concurrency tests prove that racing refresh requests do not duplicate observations, review work, or target counters.

---

## Phase 4: Safe Fetching And Certified Smartbar Ingestion

**User stories**: 22–23, 32–33

### What to build

Introduce one shared external fetch boundary and route Smartbar ingestion through it. Harden the RSS parser against a sanitized fixture captured from the live Smartbar feed, including its compact description layout. Demonstrate that a manually configured Smartbar target produces useful review candidates and becomes unchanged on the next run.

### Acceptance criteria

- [ ] Production fetching permits public HTTPS targets and rejects embedded credentials, private addresses, loopback, link-local destinations, and HTTPS downgrade.
- [ ] Requests use a 15-second timeout, a 5 MB response limit, at most three redirects, and an identifiable Sound City user agent.
- [ ] One bounded retry is allowed for network errors, `429`, and `5xx`; other client errors are not retried.
- [ ] Conditional ETag and Last-Modified requests are supported, and `304 Not Modified` produces a successful unchanged outcome.
- [ ] Target outcomes record final URL, response status, duration, size, and retry count without storing full response bodies.
- [ ] Smartbar parsing supports the certified fixture’s title, event date, doors time, lineup, price, age policy, venue, and canonical source URL when present.
- [ ] Smartbar uses its canonical item link as source identity when no feed GUID exists.
- [ ] Entity cleanup and compact-description parsing are covered by fixture tests.
- [ ] A live manual Smartbar run creates useful review work.
- [ ] A second unchanged manual Smartbar run creates zero new review items.
- [ ] Smartbar remains at manual cadence until its certification criteria pass.

---

## Phase 5: Radius Ingestion With Bounded Enrichment

**User stories**: 24–25

### What to build

Certify Radius as the second RSS shape. Use its RSS GUID for stable identity and parse its event date from the RSS title. Follow only the official detail URL supplied by each item to enrich event time, doors, age policy, and ticket information. Treat detail failures as item warnings when the feed item remains usable; do not turn this into a general crawler.

### Acceptance criteria

- [ ] Radius RSS GUID is used as the stable source event key.
- [ ] Radius event date and normalized title are extracted from the certified RSS title shape.
- [ ] Enrichment fetches only the official Radius detail URL supplied by the RSS item.
- [ ] Enrichment uses the shared fetch policy and cannot escape to arbitrary or unsafe hosts.
- [ ] Labeled event time, doors time, age policy, and ticket URL are captured when available.
- [ ] RSS and event-detail behavior are covered by separate sanitized fixtures.
- [ ] One failed detail request is an item warning and does not hide valid sibling events.
- [ ] An item that still lacks a reliable event time is routed to review/source-health rather than guessed.
- [ ] The Radius target fails only when the feed itself is unusable or no item can be interpreted reliably.
- [ ] A live manual Radius run creates useful review work.
- [ ] A second unchanged manual Radius run creates zero new review items.
- [ ] Radius remains at manual cadence until its certification criteria pass.

---

## Phase 6: Relevant ICS Source And Extensible Enrollment

**User stories**: 22, 26–29

### What to build

Time-box discovery of a stable official Chicago ICS subscription feed that is relevant to Sound City’s music scope. Capture its fixture, close only the generic parser gaps that the fixture exposes, and certify it through manual refresh. Constrain cadence configuration to manual or daily and make cadence promotion the explicit enrollment mechanism for this and future ICS targets.

### Acceptance criteria

- [ ] ICS discovery is time-boxed to approximately two working days.
- [ ] The selected feed is official, publicly fetchable, stable, Chicago-based, subscription-oriented, and relevant to Sound City discovery.
- [ ] An irrelevant calendar or per-event ICS download is not substituted solely to satisfy protocol coverage.
- [ ] If no qualifying feed is found, the release gate is explicitly re-scoped with the product owner before Cron is enabled.
- [ ] A sanitized fixture represents the selected live ICS feed.
- [ ] The parser reliably captures UID, title, start/end time, timezone, venue, event URL, and other material fields supplied by the certified source.
- [ ] Invalid individual events are isolated without hiding valid siblings.
- [ ] A live manual ICS run creates useful review work.
- [ ] A second unchanged manual ICS run creates zero new review items.
- [ ] Source-target cadence accepts only `manual` or `daily` in Phase 9.
- [ ] Newly created production targets default to manual cadence.
- [ ] Admin explains that daily cadence enrolls an enabled target in scheduled refresh.
- [ ] Adding a compatible future ICS target requires configuration, fixture certification, and cadence promotion but no scheduler code change.
- [ ] The qualifying ICS source remains a hard Phase 9 release gate.

---

## Phase 7: Protected Daily Scheduled Refresh

**User stories**: 1–2, 16–18, 30–31

### What to build

Expose the generalized refresh engine through one fail-closed Cron route and configure one daily production invocation. Select enabled daily targets server-side, retain the review-only stale-task stage, and return platform-visible failure for partial or failed runs while preserving all durable source outcomes. Roll sources into the schedule one at a time.

### Acceptance criteria

- [ ] The Cron route accepts only an exact `Authorization: Bearer ${CRON_SECRET}` credential.
- [ ] Missing Cron configuration fails closed and performs no work.
- [ ] Invalid or missing credentials return unauthorized and perform no work.
- [ ] Admin credentials are not accepted by the Cron route.
- [ ] Request parameters cannot select targets or override cadence.
- [ ] Only enabled daily targets are selected; enabled manual targets remain excluded.
- [ ] The scheduled trigger and actor are recorded distinctly from manual refresh.
- [ ] Scheduled execution waits for a terminal run result and returns its durable identifier and summary.
- [ ] Succeeded and skipped runs return a successful response.
- [ ] Partial and failed runs return a server error so platform observability records degradation.
- [ ] A target failure does not discard candidates or observations produced by successful targets.
- [ ] The existing past-event stale-task stage runs and remains review-only.
- [ ] The Vercel schedule invokes the route once daily in UTC on production deployments only.
- [ ] Route integration tests cover authorization, target eligibility, terminal responses, and overlap behavior.
- [ ] No queue or background workflow infrastructure is introduced.

---

## Phase 8: Resident Advisor One-Day Feasibility Spike

**User stories**: 34–36

### What to build

Spend no more than one working day determining whether Resident Advisor exposes a compliant, stable, server-fetchable event source that fits the parser contract. Produce a documented classification and field mapping. Stop at research: do not build a production parser or experiment with prohibited access techniques in this phase.

This phase is non-blocking and may run alongside the implementation slices.

### Acceptance criteria

- [ ] The spike is capped at one working day.
- [ ] Representative public Chicago event samples and candidate structured-data paths are inventoried.
- [ ] Server-side access is tested without authentication, browser automation, session handling, CAPTCHA work, or anti-bot circumvention.
- [ ] Available identity, title, time, venue, lineup, and canonical URL fields are mapped to the parser contract.
- [ ] Access and stability constraints are documented.
- [ ] The conclusion is explicitly `viable`, `experimental only`, or `manual/supporting only`.
- [ ] Undocumented internal endpoints cannot receive a production-ready classification.
- [ ] A viable result includes a separate production-parser estimate and proposed scope.
- [ ] Experimental or manual-only results do not create scheduled Phase 9 work.

---

## Phase 9: Staged Production Certification

**User stories**: 22, 28–30

### What to build

Certify the complete production path incrementally. Keep every target manually runnable, promote only one certified source at a time, observe scheduled behavior, and use cadence demotion as the first rollback. Complete the release only after all three matrix sources operate without duplicate review work.

### Acceptance criteria

- [ ] Smartbar, Radius, and the selected relevant ICS target each pass automated fixture and engine integration tests.
- [ ] Each target completes two consecutive manual runs, with the unchanged second run creating zero new review items.
- [ ] Only one source is promoted to daily cadence at a time.
- [ ] Each promoted source completes two acceptable scheduled runs before the next source is promoted.
- [ ] Target outcomes, partial-run reporting, operational health, and active-run behavior are verified in Admin.
- [ ] A problematic source can be returned to manual cadence without disabling manual refresh or affecting other targets.
- [ ] Scheduled failures are visible in both Vercel observability and durable Admin history.
- [ ] The certified matrix produces no duplicate queue items across unchanged daily runs.
- [ ] The relevant ICS source is active before Phase 9 is marked complete.
- [ ] Repository tests, lint, type checking, and production build pass before deployment.
- [ ] Production configuration includes the Cron secret and the daily schedule.
- [ ] Phase 9 completion is recorded only after the staged rollout gates pass.
