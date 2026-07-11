import { beforeEach, describe, expect, it } from "vitest";

import type { RefreshStore } from "../refresh-store";
import { createSeedRefreshStore } from "../store";

const observationInput = {
  sourceTargetId: "target_smartbar",
  sourceEventKey: "smartbar-event-42",
  matchFingerprint:
    "queen-with-derrick-carter:2026-06-29t03-00-00-000z:smartbar",
  materialContentHash: "a".repeat(64),
  normalizedCandidate: {
    title: "Queen! with Derrick Carter",
    startsAt: "2026-06-29T03:00:00.000Z",
    venueName: "Smartbar",
  },
  seenAt: "2026-07-11T12:00:00.000Z",
  latestReviewItemId: null,
  publishedEventId: null,
  parserVersion: "rss-event-feed@1",
};

describe("source event observation store", () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createSeedRefreshStore();
  });

  it("persists and retrieves an observation by source target and source event key", async () => {
    const created = await store.createSourceEventObservation(observationInput);

    const found = await store.getSourceEventObservation(
      "target_smartbar",
      "smartbar-event-42",
    );

    expect(found).toEqual(created);
    expect(found).toMatchObject({
      firstSeenAt: "2026-07-11T12:00:00.000Z",
      lastSeenAt: "2026-07-11T12:00:00.000Z",
      lastChangedAt: "2026-07-11T12:00:00.000Z",
    });
  });

  it("rejects a second observation with the same source target and source event key", async () => {
    await store.createSourceEventObservation(observationInput);

    await expect(
      store.createSourceEventObservation(observationInput),
    ).rejects.toThrow(/already exists/i);
  });
});
