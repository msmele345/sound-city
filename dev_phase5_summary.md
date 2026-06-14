# Phase 5 Implementation Summary

## Overview

Executed Phase 5 of the Sound City V2 plan: **Stale Tasks and Source Health**.

## What Changed

### Database Schema

- Added per-target counters to `source_targets`:
  - `failure_count`
  - `rejection_count`
  - `duplicate_count`
- Made `review_items.source_target_id` nullable so stale tasks (which are generated from the catalog, not a fetched source target) are valid.
- Added migration: `db/migrations/0002_v2_phase5_source_health.sql`.

### Refresh Engine

`src/server/refresh/engine.ts`

- After parsing enabled source targets, the engine queries the catalog for events where `startsAt < now` and creates `stale-task` review items.
- Stale tasks are created via a DB query only — no network fetch.
- Stale tasks never auto-delete or auto-archive catalog records.
- Per-target counters are updated during the run:
  - `failureCount` increments when a target fails.
  - `duplicateCount` increments for each `possible-duplicate` candidate.
- Target timestamps are recorded: `lastFetchedAt`, `lastSuccessfulRunAt`, `lastFailureAt`, `lastFailureReason`.

### Review Operations

`src/server/refresh/review-operations.ts`

- `rejectReviewItem` increments the source target's `rejectionCount` when the review item has a source target.
- Stale tasks with `sourceTargetId: null` do not affect counters.

### Store Layer

- Added `incrementSourceTargetCounters` to both the Drizzle and seed refresh stores.
- Updated row mapping, create paths, and types for the new counters and nullable `sourceTargetId`.

### Admin UI

`src/components/admin-source-targets.tsx`

- Each source target row displays `failures / rejections / duplicates`.
- Added a "Source Health" panel showing:
  - **Last coverage**: `sourceTargetsChecked / enabled targets`
  - **Approval rate**: `approved / (approved + rejected)`
- After a refresh run, the UI reloads source targets so counters update immediately.

### Tests

- Added tests for stale task generation, catalog preservation, counter increments, and source health metrics.
- Updated existing tests to account for the new nullable `sourceTargetId` behavior.

## Verification

All verification commands passed:

```bash
npm test          # 169 tests passed
npm run typecheck # passed
npm run lint      # passed (only pre-existing warnings remain)
npm run build     # passed
```

## Acceptance Criteria

- [x] Past events (`startsAt < now`) create stale tasks via a DB query.
- [x] Stale tasks never auto-delete or auto-archive catalog records.
- [x] Per-target counters (failures, rejections, duplicates) are recorded and shown.
- [x] Admins can manually set `healthStatus` (already supported).
- [x] Admins see source coverage and derived approval-rate metrics.

## Deferred

- Broken-link / link-rot detection.
- Automatic confidence degradation.
