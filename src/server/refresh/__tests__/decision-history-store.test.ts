import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { ReviewDecisionRecord, CreateReviewItemInput } from "../types";

async function setupItem(store: RefreshStore): Promise<string> {
  const item = await store.createReviewItem({
    cityId: "city_chicago",
    runId: "run_1",
    sourceTargetId: "st_1",
    lane: "new-event",
    priority: 1,
    confidence: 0.9,
    confidenceReasons: ["venue match"],
    targetEntityType: "event",
    targetEntityId: null,
    matchFingerprint: "fp_test",
    normalizedDraft: { title: "Test Event" },
    fieldDiffs: null,
    linkedDrafts: [],
    conflicts: null,
    evidence: { sourceUrls: ["https://example.com"], excerpts: ["test"], contentHashes: ["abc"] },
    parserVersion: "1.0.0",
    fetchTimestamp: new Date().toISOString(),
  });
  return item.id;
}

function makeDecision(
  overrides: Partial<Omit<ReviewDecisionRecord, "id" | "createdAt">> & { reviewItemId: string },
): Omit<ReviewDecisionRecord, "id" | "createdAt"> {
  return {
    reviewItemId: overrides.reviewItemId,
    decision: overrides.decision ?? "approved",
    fieldName: overrides.fieldName ?? null,
    reason: overrides.reason ?? null,
    notes: overrides.notes ?? null,
    reviewedBy: overrides.reviewedBy ?? "admin-secret",
  };
}

describe("decision history store", () => {
  let store: RefreshStore;

  beforeEach(async () => {
    store = createSeedRefreshStore();
  });

  it("creates a decision history entry", async () => {
    const itemId = await setupItem(store);

    const decision = await store.createDecisionHistory(makeDecision({ reviewItemId: itemId }));

    expect(decision.id).toBeDefined();
    expect(decision.reviewItemId).toBe(itemId);
    expect(decision.decision).toBe("approved");
    expect(decision.createdAt).toBeDefined();
  });

  it("lists decision history for a review item", async () => {
    const itemId = await setupItem(store);
    await store.createDecisionHistory(makeDecision({ reviewItemId: itemId }));
    await store.createDecisionHistory(
      makeDecision({ reviewItemId: itemId, decision: "edited", notes: "Fixed title" }),
    );

    const history = await store.listDecisionHistory(itemId);

    expect(history).toHaveLength(2);
    expect(history[0].decision).toBe("approved");
    expect(history[1].decision).toBe("edited");
  });

  it("records rejected decisions", async () => {
    const itemId = await setupItem(store);

    await store.createDecisionHistory(
      makeDecision({
        reviewItemId: itemId,
        decision: "rejected",
        reason: "Duplicate",
        notes: "Already in catalog",
      }),
    );

    const history = await store.listDecisionHistory(itemId);
    expect(history).toHaveLength(1);
    expect(history[0].decision).toBe("rejected");
    expect(history[0].reason).toBe("Duplicate");
  });

  it("records field-level decisions", async () => {
    const itemId = await setupItem(store);

    await store.createDecisionHistory(
      makeDecision({
        reviewItemId: itemId,
        decision: "field-accepted",
        fieldName: "startsAt",
      }),
    );
    await store.createDecisionHistory(
      makeDecision({
        reviewItemId: itemId,
        decision: "field-rejected",
        fieldName: "title",
        reason: "Bad parse",
      }),
    );

    const history = await store.listDecisionHistory(itemId);

    expect(history).toHaveLength(2);
    expect(history[0].fieldName).toBe("startsAt");
    expect(history[1].fieldName).toBe("title");
    expect(history[1].reason).toBe("Bad parse");
  });

  it("returns empty history for item with no decisions", async () => {
    const itemId = await setupItem(store);

    const history = await store.listDecisionHistory(itemId);

    expect(history).toHaveLength(0);
  });
});
