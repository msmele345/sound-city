  # Plan: Admin Refresh Workflow Feedback

  > Source: PRD admin validation/refresh stories and the current `/admin/sources` UX assessment.

  ## Architectural decisions

  - Create `feature/admin-refresh-feedback` from `develop`.
  - Keep existing API routes, database schema, and review operations unchanged.
  - Use inline confirmation and feedback—not modal dialogs—to preserve the industrial, rule-based design language.
  - Track submitting/error state per review item; show completed actions in a persistent review-section message.
  - Use `role="status"` for progress/success and `role="alert"` for errors.
  - Follow one-test/one-implementation red-green-refactor cycles throughout.

  ## Phase 1: Approval lifecycle tracer

  **User story:** As an admin, I can confidently approve an event and know whether it was published.

  ### What to build

  Add the complete lifecycle for new-event approval:

  - Selecting “Approve” opens an inline confirmation with the event title, publishing consequence, Confirm, and Cancel.
  - Confirm changes to “Approving…”, disables all actions for that item, and prevents duplicate requests.
  - Success removes the item from the pending view and displays a persistent message: “Approved and published: {title},” with a “View approved” action.
  - Failure keeps the item visible, preserves its state, and displays an actionable item-level error.
  - Background data reloads must not overwrite the result message.

  ### Acceptance criteria

  - [ ] Approval is never submitted before explicit confirmation.
  - [ ] Cancel performs no request.
  - [ ] Only one request can run for an item.
  - [ ] Progress and success are announced accessibly.
  - [ ] Failure leaves the action recoverable.
  - [ ] Tests cover confirm, cancel, duplicate prevention, success, and failure.

  ## Phase 2: Rejection and lane-specific actions

  **User story:** As an admin, I understand the consequence of each review action and do not lose rejection details when something fails.

  ### What to build

  Extend the lifecycle across every review lane:

  - Rejection confirmation names the item and requires a reason.
  - Keep the rejection form open until success; preserve reason and notes after failure.
  - Replace generic “Approve” terminology:
    - New event: “Approve and publish”
    - Proposed update: “Apply selected changes”
    - Possible duplicate: “Resolve duplicate”
    - Stale task/source health: “Acknowledge”
    - Edited draft: “Approve edits and publish”
  - Show lane-specific success messages and provide links to the relevant decided filter.
  - Apply the same submitting, disabled, error, and accessibility behavior to every action.

  ### Acceptance criteria

  - [ ] Rejection cannot submit without a reason.
  - [ ] Failed rejection retains all entered values.
  - [ ] Every action label accurately describes its backend consequence.
  - [ ] Selected update fields and unsaved draft edits remain in the submitted payload.
  - [ ] Tests cover each lane’s action text and the rejection success/failure paths.

  ## Phase 3: Refresh-run feedback and hardening

  **User story:** As an admin, I can start a refresh and clearly understand its progress and outcome.

  ### What to build

  Complete the page-level operational feedback:

  - Disable “Run refresh” while active and display “Running {count} enabled targets…”.
  - On completion, show run status and metrics plus “{count} items need review” with a “View pending” action.
  - On failure, retain the previous run data and show recovery guidance beside the refresh control.
  - Replace the permanently assertive global alert with correctly scoped status and error regions.
  - Preserve the existing monochrome palette, square controls, structural borders, and single amber signal color.
  - Verify keyboard navigation, focus visibility, 200% zoom behavior, and narrow-screen layout.

  ### Acceptance criteria

  - [ ] Refresh cannot be triggered twice while running.
  - [ ] Success remains visible after source data reloads.
  - [ ] Failure does not erase the last successful run.
  - [ ] Pending-review navigation applies the correct filter and focus target.
  - [ ] Full component tests, typecheck, lint, and production build pass.
  - [ ] Manual keyboard and responsive checks pass on `/admin/sources`.

  ## Assumptions

  - Routine refresh runs do not require confirmation; clear progress and completion feedback are sufficient.
  - Undo is excluded because no reversal API currently exists.
  - Existing admin authentication and session-secret behavior remain unchanged.
  - No cards, shadows, extra accent colors, or toast-only feedback will be introduced.