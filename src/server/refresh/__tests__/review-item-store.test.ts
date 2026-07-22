import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { CreateReviewItemInput } from "../types";

async function setup(store: RefreshStore) {
  const owner = await store.createSourceOwner({
    cityId: "city_chicago",
    name: "smartbar",
    slug: "smartbar",
    kind: "venue",
    notes: "",
  });
  const target = await store.createSourceTarget({
    ownerId: owner.id,
    cityId: "city_chicago",
    url: "https://smartbarchicago.com/calendar",
    sourceType: "official-venue-calendar",
    parserStrategy: "venue-calendar",
    trustLevel: "primary",
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy",
    refreshCadence: "daily",
    notes: "",
  });
  const run = await store.createRefreshRun({
    cityId: "city_chicago",
    trigger: "manual",
    triggeredBy: "admin-secret",
  });
  return { owner, target, run };
}

function makeItem(
  overrides: Partial<CreateReviewItemInput>,
): CreateReviewItemInput {
  const ts = new Date().toISOString();
  return {
    cityId: "city_chicago",
    runId: "run_1",
    sourceTargetId: "st_1",
    lane: "new-event",
    priority: 1,
    confidence: 0.9,
    confidenceReasons: ["venue match", "title match"],
    targetEntityType: "event",
    targetEntityId: null,
    matchFingerprint: "fp_smartbar_friday_night",
    normalizedDraft: {
      title: "Friday Night House",
      venueSlug: "smartbar",
      startsAt: ts,
    },
    fieldDiffs: null,
    linkedDrafts: [],
    conflicts: null,
    evidence: {
      sourceUrls: ["https://smartbarchicago.com/calendar"],
      excerpts: ["Friday Night House — 10PM"],
      contentHashes: ["abc123"],
    },
    parserVersion: "1.0.0",
    fetchTimestamp: ts,
    ...overrides,
  };
}

describe("review item store", () => {
  let store: RefreshStore;

  beforeEach(async () => {
    store = createSeedRefreshStore();
  });

  it("creates a review item with pending status", async () => {
    const created = await store.createReviewItem(makeItem({}));

    expect(created.id).toBeDefined();
    expect(created.status).toBe("pending");
    expect(created.lane).toBe("new-event");
    expect(created.confidence).toBe(0.9);
  });

  it("rolls back observation and review-item writes when classification fails", async () => {
    await expect(
      store.withSourceEventObservationTransaction(
        "st_1",
        "event-42",
        async (transactionStore) => {
          const item = await transactionStore.createReviewItem(makeItem({}));
          await transactionStore.createSourceEventObservation({
            sourceTargetId: "st_1",
            sourceEventKey: "event-42",
            matchFingerprint: item.matchFingerprint,
            materialContentHash: "a".repeat(64),
            normalizedCandidate: item.normalizedDraft,
            seenAt: item.fetchTimestamp,
            latestReviewItemId: item.id,
            publishedEventId: null,
            parserVersion: item.parserVersion,
          });
          throw new Error("classification failed");
        },
      ),
    ).rejects.toThrow("classification failed");

    await expect(store.listReviewItems("city_chicago")).resolves.toEqual([]);
    await expect(
      store.getSourceEventObservation("st_1", "event-42"),
    ).resolves.toBeNull();
  });

  it("lists review items by city", async () => {
    await store.createReviewItem(makeItem({ cityId: "city_chicago" }));
    await store.createReviewItem(makeItem({ cityId: "city_new_york", matchFingerprint: "other" }));

    const chicago = await store.listReviewItems("city_chicago");
    const ny = await store.listReviewItems("city_new_york");

    expect(chicago).toHaveLength(1);
    expect(ny).toHaveLength(1);
  });

  it("filters review items by lane", async () => {
    await store.createReviewItem(makeItem({ lane: "new-event", matchFingerprint: "fp_1" }));
    await store.createReviewItem(makeItem({ lane: "proposed-update", matchFingerprint: "fp_2" }));
    await store.createReviewItem(makeItem({ lane: "possible-duplicate", matchFingerprint: "fp_3" }));

    const newEvents = await store.listReviewItems("city_chicago", "new-event");
    const updates = await store.listReviewItems("city_chicago", "proposed-update");
    const dupes = await store.listReviewItems("city_chicago", "possible-duplicate");
    const all = await store.listReviewItems("city_chicago");

    expect(newEvents).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(dupes).toHaveLength(1);
    expect(all).toHaveLength(3);
  });

  it("gets a review item by id", async () => {
    const created = await store.createReviewItem(makeItem({}));

    const found = await store.getReviewItem(created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("returns null for missing review item", async () => {
    const found = await store.getReviewItem("nonexistent");
    expect(found).toBeNull();
  });

  it("updates review item status to approved", async () => {
    const created = await store.createReviewItem(makeItem({}));

    const updated = await store.updateReviewItem(created.id, {
      status: "approved",
      reviewedBy: "admin-secret",
      reviewedAt: new Date().toISOString(),
    });

    expect(updated.status).toBe("approved");
    expect(updated.reviewedBy).toBe("admin-secret");
    expect(updated.reviewedAt).not.toBeNull();
  });

  it("updates review item status to rejected with reason", async () => {
    const created = await store.createReviewItem(makeItem({}));

    const updated = await store.updateReviewItem(created.id, {
      status: "rejected",
      rejectionReason: "Duplicate",
      reviewNotes: "Already exists in catalog",
    });

    expect(updated.status).toBe("rejected");
    expect(updated.rejectionReason).toBe("Duplicate");
    expect(updated.reviewNotes).toBe("Already exists in catalog");
  });

  it("updates published entity id after approval", async () => {
    const created = await store.createReviewItem(makeItem({}));

    const updated = await store.updateReviewItem(created.id, {
      status: "approved",
      publishedEntityId: "event_friday_night_house",
      publishedSourceId: "source_venue_smartbar",
    });

    expect(updated.publishedEntityId).toBe("event_friday_night_house");
    expect(updated.publishedSourceId).toBe("source_venue_smartbar");
  });

  it("supports stale-task lane", async () => {
    const created = await store.createReviewItem(
      makeItem({ lane: "stale-task", matchFingerprint: "fp_stale", priority: 0 }),
    );

    const stale = await store.listReviewItems("city_chicago", "stale-task");
    expect(stale).toHaveLength(1);
    expect(stale[0].priority).toBe(0);
  });

  it("supports source-health lane", async () => {
    await store.createReviewItem(
      makeItem({ lane: "source-health", matchFingerprint: "fp_health" }),
    );

    const health = await store.listReviewItems("city_chicago", "source-health");
    expect(health).toHaveLength(1);
  });

  it("returns empty when no items match lane filter", async () => {
    await store.createReviewItem(makeItem({ lane: "new-event", matchFingerprint: "fp_1" }));

    const stale = await store.listReviewItems("city_chicago", "stale-task");
    expect(stale).toHaveLength(0);
  });
});
