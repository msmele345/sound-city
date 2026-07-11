# spec: Phase 9 scheduled refresh reliability and parser hardening

> Tracker spec: https://github.com/msmele345/sound-city/issues/18

## Problem Statement

Sound City can manually refresh official venue sources through its review-first ingestion workflow, but unattended refresh is not yet safe. Re-running the existing parsers can create repeated review work, source targets have no durable per-run outcome records, overlapping runs are not prevented across serverless instances, and parser behavior is proven against too few real source shapes. The current cadence field does not control execution, and Resident Advisor remains configurable without a proven production-safe ingestion path.

Phase 9 must make existing-source refresh reliable enough to run daily without weakening Sound City's review-first publishing model. The release must support a small, explicit production matrix: Smartbar RSS, Radius RSS, and one relevant official Chicago ICS subscription feed. It must remain easy to certify and add more ICS targets later. Resident Advisor should be investigated, but uncertainty outside Sound City's control must not block the scheduled-refresh release.

## Solution

Add one protected daily Vercel Cron sweep that reuses a generalized refresh engine and processes enabled targets promoted to daily cadence. Make repeat processing idempotent through stable source-event identity, material content hashes, durable source observations, and atomic persistence. Prevent overlapping Chicago runs with a database-backed lease. Persist first-class per-target outcomes so partial runs and source health are diagnosable without interpreting free-form logs.

Harden fetching and the existing ICS and RSS parsers against a named source matrix rather than claiming general format compatibility. Smartbar should parse entirely from its RSS feed. Radius should receive a bounded follow-up enrichment step that fetches only the official detail URL supplied by its RSS item to obtain event time, age policy, and ticket details. A relevant official Chicago ICS source must be discovered and certified before Phase 9 is released.

Include a one-working-day Resident Advisor feasibility spike. Its result is a documented classification of viable, experimental only, or manual/supporting only. A production RA parser is not required for Phase 9 completion and should be planned separately only if a compliant, stable, non-fragile access path is proven.

## User Stories

1. As a maintainer, I want Sound City to refresh certified sources every day, so that upcoming event discovery does not depend on a manual trigger.
2. As a maintainer, I want scheduled ingestion to remain review-first, so that no parsed event is published without approval.
3. As a maintainer, I want unchanged source events suppressed on later runs, so that the review queue is not flooded with duplicates.
4. As a maintainer, I want a pending review item updated when its source event materially changes, so that I review the latest proposal rather than competing drafts.
5. As a maintainer, I want a published event to receive a field-level proposed update when its source changes, so that live catalog changes remain explicit and auditable.
6. As a maintainer, I want a rejected source event reopened only after a material change, so that repeated identical suggestions stay suppressed.
7. As a maintainer, I want formatting-only feed changes recorded without reopening review work, so that harmless source churn does not create noise.
8. As a maintainer, I want each source attempt represented by a durable outcome, so that a partial run clearly identifies what succeeded, failed, was skipped, or was unchanged.
9. As a maintainer, I want run history to summarize outcomes such as "2 of 3 sources succeeded," so that partial results are immediately understandable.
10. As a maintainer, I want successful work preserved when one source fails, so that an isolated feed problem does not discard other candidates.
11. As a maintainer, I want malformed feed items isolated from valid items, so that one bad event does not fail an otherwise usable source.
12. As a maintainer, I want repeated malformed items suppressed idempotently, so that parser warnings do not become daily duplicate review tasks.
13. As a maintainer, I want only one Chicago refresh active at a time, so that manual and scheduled executions cannot race.
14. As a maintainer, I want skipped scheduled attempts recorded and linked to the active run, so that a no-op invocation is explainable.
15. As a maintainer, I want a conflicting manual trigger to identify the active run, so that I know why another run did not start.
16. As an operator, I want the Cron route to fail closed when its secret is missing or invalid, so that unattended ingestion cannot be triggered publicly.
17. As an operator, I want Cron and Admin credentials separated, so that exposure of one credential does not grant the other capability.
18. As an operator, I want a partial or failed scheduled run to produce a failed Cron invocation, so that Vercel observability registers degradation.
19. As an operator, I want target failures to affect derived operational health, so that recurring feed problems become visible without manual counter interpretation.
20. As an operator, I want operational health to recover gradually, so that one transient success does not hide a flapping source.
21. As an operator, I want Sound City never to disable a source or change source trust automatically, so that automated health signals remain advisory.
22. As a maintainer, I want to certify Smartbar, Radius, and one relevant official Chicago ICS feed before enabling daily refresh, so that the release has a measurable compatibility contract.
23. As a maintainer, I want Smartbar feed fields parsed from its official RSS data, so that its title, time, venue, lineup, price, age policy, and source URL are reviewable when present.
24. As a maintainer, I want Radius RSS items enriched only from their official linked detail pages, so that missing event times and age policies can be captured without broad crawling.
25. As a maintainer, I want Radius enrichment failures treated as item warnings, so that the rest of the Radius feed remains usable.
26. As a maintainer, I want the ICS source to be both technically valid and relevant to Chicago music discovery, so that a protocol-only test does not pollute the product.
27. As a maintainer, I want future ICS targets added through Admin configuration, fixtures, and certification rather than scheduler code changes, so that the source matrix can grow safely.
28. As a maintainer, I want new targets to begin at manual cadence, so that live behavior can be verified before daily enrollment.
29. As a maintainer, I want cadence promotion from manual to daily to enroll a target in Cron automatically, so that rollout is explicit and reversible.
30. As a maintainer, I want targets rolled into Cron one at a time, so that scheduler and idempotency problems have a small blast radius.
31. As a maintainer, I want scheduled runs to retain the existing stale-task pass, so that past catalog events continue to produce review-only maintenance work.
32. As a maintainer, I want fetches bounded by protocol, timeout, redirects, response size, and retry rules, so that unattended external requests cannot consume unbounded resources.
33. As a source operator, I want conditional requests used when supported, so that unchanged feeds avoid unnecessary transfer and parsing.
34. As a maintainer, I want one day spent investigating RA rather than an open-ended scraping effort, so that Phase 9 remains predictable.
35. As a maintainer, I want the RA spike to stop when access requires login, CAPTCHA, browser execution, session handling, or anti-bot circumvention, so that the system respects its ingestion constraints.
36. As a maintainer, I want a separately estimated RA parser only after viability is proven, so that research findings do not silently become production scope.

## Implementation Decisions

- Phase 9's release guarantee is reliable daily refresh of existing certified ICS and RSS sources. A production RA parser is not release-critical.
- The certified release matrix is Smartbar RSS, Radius RSS, and one relevant official Chicago ICS subscription feed. The matrix defines certified behavior but is not hardcoded into scheduling logic.
- ICS-target discovery is time-boxed to approximately two working days. Shared implementation may proceed concurrently, but production Cron cannot be enabled and Phase 9 cannot be completed until a qualifying ICS source passes certification. Failure to find one requires explicit re-scoping rather than substituting an irrelevant feed, fragile HTML scrape, or per-event ICS download.
- One daily Vercel Cron entry invokes a dedicated scheduled-refresh route. Truly variable hourly, weekly, or custom per-target scheduling is deferred.
- Source cadence is constrained to manual or daily for this phase. Enabled manual targets may be run by an administrator; enabled daily targets are additionally eligible for Cron.
- Future ICS enrollment follows a two-stage process: configure the target at manual cadence, capture a fixture, pass parser and manual certification, then promote it to daily.
- The scheduled route uses a mandatory CRON_SECRET Bearer token and never accepts ADMIN_SECRET. Missing configuration fails closed. Target IDs and cadence overrides are not accepted from request parameters.
- Manual refresh continues using ADMIN_SECRET and the existing Admin route.
- The refresh engine is generalized to accept a trigger and target-selection policy rather than duplicating manual and scheduled execution paths.
- Scheduled execution is synchronous for the small source matrix. The route returns the durable run ID and summary after the run reaches a terminal state. Queues and background workflow infrastructure are deferred.
- Successful and skipped scheduled runs return a successful HTTP response. Partial and failed runs return a server error so platform observability records degradation, while durable run data preserves successful target work.
- Run status supports pending, running, succeeded, partial, failed, and skipped. Partial remains a single unambiguous status; target outcomes contain the diagnostic detail.
- A database-backed per-city lease enforces one active refresh. Scheduled overlap produces a terminal skipped run linked to the active run. Manual overlap returns conflict with the active run ID. Leases older than the existing orphan threshold are recoverable.
- Add normalized per-target run outcomes with one row per run and source target. Outcomes support running, succeeded, failed, skipped, and unchanged, with timestamps, candidate and review-item counts, warning count, error details, request duration, response size, retry count, and final URL. The run/target pair is unique.
- Logs remain diagnostic; they are not the primary reporting model for target outcomes.
- Add durable source-event observations keyed uniquely by source target and source event key. An observation retains the cross-source match fingerprint, latest material content hash, compact normalized candidate snapshot, first/last seen timestamps, last-changed timestamp, latest review item reference, optional published catalog event reference, and parser version.
- Source event key, match fingerprint, and content hash are distinct concepts. ICS uses UID as the preferred source event key. RSS uses guid when available and otherwise a canonical item link. Cross-source fingerprints omit parser-specific prefixes and use normalized event attributes. Material hashes cover normalized catalog-relevant fields.
- Material fields are title, start/end time, venue, artists or lineup, canonical or ticket URL, price, age policy, normalized styles, and a review-only cancellation signal. Feed ordering, formatting, publication timestamps, tracking parameters, fetch timestamps, evidence wording, and parser version alone are not material.
- Evidence-only changes may be recorded separately but do not reopen review work.
- New observations create review items. Unchanged observations create no review item. Material changes update an existing pending review item, create a proposed update after publication, or reopen a rejected observation only when its material hash changes.
- Idempotent classification and writes must be atomic in persistence; application-memory checks are insufficient.
- The existing stale-task pass runs during scheduled execution as a separately reported run-level stage. It remains review-only and never deletes or archives catalog records.
- Smartbar is parsed from RSS without linked-page fetching. Its fixture contract covers its actual compact description shape, including concatenated date/time, lineup, price, and age-policy text.
- Radius uses guid as stable source identity and parses the date from its RSS title. A bounded follow-up enrichment step fetches only the official item detail URL and extracts labeled event time, doors, age policy, and ticket URL. It is not a general crawler. Enrichment failure is an item warning unless no reliable event can be formed.
- The RSS parser should use standards-aware XML handling appropriate to the certified fixtures rather than relying on format claims unsupported by tests. Broader Atom and custom namespace compatibility is added only when a certified source requires it.
- Item-level errors do not fail a target when other items can be processed. A target fails for fetch failure, unexpected document format, document-level parse failure, or when no event can be interpreted reliably. A successful target may carry warnings.
- The shared fetch policy permits public HTTPS targets in production, rejects embedded credentials and private, loopback, or link-local destinations, limits redirects to three without HTTPS downgrade, uses a 15-second timeout and 5 MB response limit, identifies Sound City with a user agent, and retries once for network errors, rate limits, and server errors. Other client errors are not retried.
- Conditional ETag and Last-Modified requests are used when supported. A 304 response is a successful unchanged target outcome.
- Full external response bodies are not persisted in production logs. Compact fixtures and evidence follow the existing review-first evidence policy.
- Derived operational health uses target outcomes, not automatic trust scoring. One failure produces a warning; two consecutive failures derive degraded; four derive failing. One success improves failing to degraded, and two consecutive successes restore healthy. Successful unchanged outcomes count as successes; skipped runs do not affect health.
- Derived health never disables a target and never changes trust level or confidence adjustment. Automatic confidence degradation remains out of scope.
- Cron rollout is staged one source at a time. Each source must pass fixture tests and manual certification, including an immediate repeated unchanged run that creates zero new review items. Each promoted source is observed for two scheduled runs before the next source is promoted.
- The RA feasibility spike is capped at one working day. It inventories public structured or embedded server-rendered data, tests representative server-side fetches, checks access and stability constraints, maps available fields to the parser contract, and produces a viable, experimental-only, or manual/supporting-only classification.
- RA is viable only when data is publicly fetchable without authentication or browser automation, provides stable identity and core event fields, works across representative samples, and needs no anti-bot circumvention. Undocumented internal endpoints are experimental only. Browser-only, authenticated, CAPTCHA, session-cookie, or fragile presentation paths remain manual/supporting only.
- Limited Radius detail enrichment is an explicit Phase 9 follow-up item and must not be omitted from the final certified Radius behavior.
- No public catalog UI behavior changes in this phase. All ingestion remains review-first.

## Testing Decisions

- Development follows red-green-refactor. Tests assert externally visible behavior and durable state transitions rather than private helper implementation.
- The primary seam is refresh-engine integration with injected fetch responses and real refresh-store behavior. It covers target selection, identity classification, observations, repeat suppression, material updates, target outcomes, run aggregation, health transitions, stale tasks, and single-flight behavior.
- Parser contract tests use sanitized golden fixtures for live Smartbar RSS, Radius RSS plus its official detail-page shape, and the selected ICS source. Live network calls are excluded from CI.
- Persistence tests verify observation uniqueness, atomic repeat handling, per-target outcome uniqueness, lease acquisition/recovery, and concurrent classification behavior.
- Scheduled-route tests cover fail-closed CRON_SECRET handling, daily target selection, scheduled trigger attribution, overlap and skipped behavior, and HTTP signaling for succeeded, partial, and failed runs.
- Existing Admin route tests continue to protect manual-refresh behavior and active-run conflict reporting.
- Admin component tests cover target-outcome summaries, partial-run presentation, derived health warnings, manual-to-daily cadence promotion, and active-run messaging. UI work must preserve the established industrial warehouse design invariants.
- Parser fixtures include malformed-item cases proving valid siblings still process, plus document-level failures proving target failure behavior.
- Idempotency tests run the same feed twice and assert that the second run creates no review items. Changed-field fixtures assert pending-item updates, post-publication proposed updates, and rejected-item reopening only on material change.
- Fetch-policy tests cover timeout, size limit, redirect downgrade, private-address rejection, retry eligibility, conditional requests, and 304 handling.
- Manual certification uses live source targets after automated tests pass. Each source is manually run twice, then promoted and observed through two scheduled runs before the next target is enrolled.
- The full repository verification commands remain required before deployment.

## Out of Scope

- A production Resident Advisor parser unless a later separately planned phase follows a viable spike result.
- Browser automation, login flows, CAPTCHA handling, anti-bot bypass, or session-cookie scraping.
- Broad web crawling or general-purpose linked-page enrichment.
- General compatibility claims for every ICS, RSS, Atom, or custom event-feed variant.
- Truly variable per-target schedules beyond manual and daily.
- Queue, workflow, or background-job infrastructure beyond synchronous Vercel Cron execution.
- Automatic publishing of parsed changes.
- Automatic source disablement, trust changes, or confidence-decay scoring.
- First-class public cancellation state.
- Public multi-source badges or an event-sources catalog join.
- Treating feed omission as cancellation or staleness.
- Using an irrelevant or non-Chicago ICS feed solely to satisfy protocol coverage.

## Further Notes

- Phase 9 should be implemented on a feature branch from develop and merged through a reviewed pull request using squash merge.
- The relevant ICS source remains a discovery deliverable and release gate; it is intentionally not guessed in this spec.
- The small certified matrix is designed to grow. Adding a source should normally require configuration, a fixture, certification, and cadence promotion—not scheduler changes.
- Observation history should be retained durably because it is required for repeat suppression and change detection. With the initial matrix, outcome-row volume is small enough that retention cleanup is not required in this phase.

