import { describe, it, expect, beforeEach } from "vitest";
import { createSeedCatalogStore } from "../../catalog/catalog-store";
import { createSeedRefreshStore } from "../store";
import {
  approveReviewItem,
  rejectReviewItem,
  canonicalSourceId,
} from "../review-operations";
import type { CatalogStore } from "../../catalog/catalog-store";
import type { RefreshStore } from "../refresh-store";
import type { CreateReviewItemInput, RefreshSnapshot } from "../types";

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
    matchFingerprint: "fp_test",
    normalizedDraft: {
      title: "Friday Night House",
      venueName: "Smartbar",
      venueSlug: "smartbar",
      startsAt: ts,
      styles: ["house", "techno"],
      artistNames: ["DJ Test"],
      ticketUrl: "https://tickets.example.com/friday",
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

function createRefreshStoreWithTarget(): RefreshStore {
  const timestamp = new Date().toISOString();
  const owner = {
    id: "source_owner_test",
    cityId: "city_chicago",
    name: "Test Owner",
    slug: "test-owner",
    kind: "venue" as const,
    notes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const target = {
    id: "st_1",
    ownerId: owner.id,
    cityId: "city_chicago",
    url: "https://example.com/calendar",
    sourceType: "official-venue-calendar" as const,
    parserStrategy: "venue-calendar" as const,
    trustLevel: "primary" as const,
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy" as const,
    failureCount: 0,
    rejectionCount: 0,
    duplicateCount: 0,
    refreshCadence: "daily",
    lastFetchedAt: null,
    lastSuccessfulRunAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    notes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const snapshot: RefreshSnapshot = {
    sourceOwners: [owner],
    sourceTargets: [target],
    refreshRuns: [],
    runLogs: [],
    reviewItems: [],
    decisionHistory: [],
  };
  return createSeedRefreshStore(snapshot);
}

describe("review-operations", () => {
  let refreshStore: RefreshStore;
  let catalogStore: CatalogStore;

  beforeEach(async () => {
    refreshStore = createRefreshStoreWithTarget();
    catalogStore = createSeedCatalogStore();
  });

  // ─── canonicalSourceId ────────────────────────────────────────────

  describe("canonicalSourceId", () => {
    it("generates a canonical source id from evidence URLs", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const sourceId = canonicalSourceId(item);
      expect(sourceId).toBe(
        "source_review_" +
          item.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) +
          "_https-smartbarchicago-com-calendar",
      );
    });

    it("uses source target name in the prefix when provided", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const sourceId = canonicalSourceId(item, "Smartbar Calendar");
      expect(sourceId).toContain("source_smartbar-calendar_");
    });

    it("throws when evidence has no source URLs", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          evidence: { sourceUrls: [], excerpts: [], contentHashes: [] },
        }),
      );

      expect(() => canonicalSourceId(item)).toThrow(
        "Review item has no evidence source URLs",
      );
    });
  });

  // ─── approveReviewItem ────────────────────────────────────────────

  describe("approveReviewItem", () => {
    it("approves a new-event review item and publishes the event", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      expect(result.publishedEntityId).toBeDefined();
      expect(result.publishedEntityId).toMatch(/^event_/);
      expect(result.reviewItem.status).toBe("approved");
      expect(result.reviewItem.reviewedBy).toBe("admin-secret");
      expect(result.reviewItem.reviewedAt).not.toBeNull();

      // Verify the event was actually created in the catalog
      const events = await catalogStore.listEvents("chicago");
      const created = events.find((e) => e.id === result.publishedEntityId);
      expect(created).toBeDefined();
      expect(created!.title).toBe("Friday Night House");
      expect(result.publishedSourceId).toBe(created!.source.id);
      expect(result.reviewItem.publishedSourceId).toBe(created!.source.id);
    });

    it("publishes a new event and creates linked venue when it doesn't exist", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "Bass Night",
            venueName: "New Venue",
            venueSlug: "new-venue",
            startsAt: new Date().toISOString(),
            styles: ["dubstep"],
          },
          linkedDrafts: [
            {
              type: "venue",
              name: "New Venue",
              slug: "new-venue",
              neighborhood: "Logan Square",
              address: "123 Bass Ave",
            },
          ],
        }),
      );

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      const venues = await catalogStore.listVenues("chicago");
      const created = venues.find((v) => v.slug === "new-venue");
      expect(created).toBeDefined();
      expect(created!.name).toBe("New Venue");
    });

    it("publishes a new event and creates linked artists when they don't exist", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "Artist Night",
            venueName: "Smartbar",
            venueSlug: "smartbar",
            startsAt: new Date().toISOString(),
            styles: ["Melodic Techno", "hard house"],
          },
          linkedDrafts: [
            {
              type: "artist",
              name: "New Artist",
              slug: "new-artist",
              bio: "A fresh face",
              styles: ["groovy-techno", "leftfield bass"],
            },
          ],
        }),
      );

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      const artists = await catalogStore.listArtists("chicago");
      const created = artists.find((a) => a.slug === "new-artist");
      expect(created).toBeDefined();
      expect(created!.name).toBe("New Artist");
      expect(created!.styles).toEqual(["groovy", "leftfield bass"]);

      const events = await catalogStore.listEvents("chicago");
      const publishedEvent = events.find((event) => event.title === "Artist Night");
      expect(publishedEvent?.styles).toEqual(["melodic", "hard house"]);
    });

    it("reuses existing venue instead of creating a duplicate", async () => {
      // Create a venue first
      await catalogStore.createVenue({
        id: "venue_smartbar",
        citySlug: "chicago",
        name: "Smartbar",
        slug: "smartbar",
        neighborhood: "Wrigleyville",
        address: "3730 N Clark St",
        capacity: 400,
        source: {
          id: "source_venue_smartbar",
          title: "Smartbar",
          url: "https://smartbarchicago.com",
          lastVerifiedAt: new Date().toISOString(),
        },
        signals: [],
      });

      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "Smartbar Night",
            venueName: "Smartbar",
            venueSlug: "smartbar",
            startsAt: new Date().toISOString(),
            styles: ["house"],
          },
        }),
      );

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      // Should use existing venue
      const events = await catalogStore.listEvents("chicago");
      const created = events.find((e) => e.id === result.publishedEntityId);
      expect(created!.venue.slug).toBe("smartbar");
    });

    it("reuses existing artist instead of creating a duplicate", async () => {
      await catalogStore.createArtist({
        id: "artist_existing_dj",
        citySlug: "chicago",
        name: "Existing DJ",
        slug: "existing-dj",
        bio: "Been here a while",
        showcase: false,
        styles: ["techno"],
        source: {
          id: "source_artist_existing_dj",
          title: "RA",
          url: "https://ra.co/dj/existing-dj",
          lastVerifiedAt: new Date().toISOString(),
        },
        links: [],
      });

      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "DJ Night",
            venueName: "Smartbar",
            venueSlug: "smartbar",
            startsAt: new Date().toISOString(),
            styles: ["techno"],
          },
          linkedDrafts: [
            {
              type: "artist",
              name: "Existing DJ",
              slug: "existing-dj",
            },
          ],
        }),
      );

      // Create the venue so the event can be published
      await catalogStore.createVenue({
        id: "venue_smartbar",
        citySlug: "chicago",
        name: "Smartbar",
        slug: "smartbar",
        neighborhood: "Wrigleyville",
        address: "3730 N Clark St",
        capacity: 400,
        source: {
          id: "source_venue_smartbar",
          title: "Smartbar",
          url: "https://smartbarchicago.com",
          lastVerifiedAt: new Date().toISOString(),
        },
        signals: [],
      });

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      const events = await catalogStore.listEvents("chicago");
      const created = events.find((e) => e.id === result.publishedEntityId);
      const dj = created!.artists.find((a) => a.slug === "existing-dj");
      expect(dj).toBeDefined();
    });

    it("accepts an edited draft via options", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const editedDraft = {
        title: "Admin Revised Title",
        venueName: "Smartbar",
        venueSlug: "smartbar",
        startsAt: new Date().toISOString(),
        styles: ["Trance Techno", "house"],
      };

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
        { editedDraft },
      );

      const events = await catalogStore.listEvents("chicago");
      const created = events.find((e) => e.id === result.publishedEntityId);
      expect(created!.title).toBe("Admin Revised Title");
      expect(created!.styles).toEqual(["trance", "house"]);
    });

    it("approves a proposed-update with field-level acceptance", async () => {
      // First create an event in the catalog to update
      const venue = await catalogStore.createVenue({
        id: "venue_smartbar",
        citySlug: "chicago",
        name: "Smartbar",
        slug: "smartbar",
        neighborhood: "Wrigleyville",
        address: "3730 N Clark St",
        capacity: 400,
        source: {
          id: "source_venue_smartbar",
          title: "Smartbar",
          url: "https://smartbarchicago.com",
          lastVerifiedAt: new Date().toISOString(),
        },
        signals: [],
      });

      const artist = await catalogStore.createArtist({
        id: "artist_dj_test",
        citySlug: "chicago",
        name: "DJ Test",
        slug: "dj-test",
        bio: "",
        showcase: false,
        styles: ["house"],
        source: {
          id: "source_artist_dj_test",
          title: "RA",
          url: "https://ra.co/dj/dj-test",
          lastVerifiedAt: new Date().toISOString(),
        },
        links: [],
      });

      const event = await catalogStore.createEvent({
        id: "event_smartbar_night",
        citySlug: "chicago",
        title: "Smartbar Night",
        slug: "smartbar-night",
        startsAt: new Date().toISOString(),
        venue,
        artists: [artist],
        styles: ["house"],
        source: {
          id: "source_event_smartbar_night",
          title: "Smartbar Calendar",
          url: "https://smartbarchicago.com/calendar",
          lastVerifiedAt: new Date().toISOString(),
        },
      });

      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "proposed-update",
          targetEntityType: "event",
          targetEntityId: event.id,
          fieldDiffs: {
            title: { current: "Smartbar Night", proposed: "Smartbar Mega Night" },
            startsAt: {
              current: event.startsAt,
              proposed: new Date(Date.now() + 3600000).toISOString(),
            },
          },
          normalizedDraft: {
            title: "Smartbar Mega Night",
            startsAt: new Date(Date.now() + 3600000).toISOString(),
          },
        }),
      );

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
        { acceptedFields: ["title", "startsAt"] },
      );

      expect(result.reviewItem.status).toBe("approved");
      expect(result.publishedEntityId).toBe(event.id);

      // Verify the event was updated in the catalog
      const events = await catalogStore.listEvents("chicago");
      const updated = events.find((e) => e.id === event.id);
      expect(updated!.title).toBe("Smartbar Mega Night");
      expect(result.publishedSourceId).toBe(updated!.source.id);
      expect(result.reviewItem.publishedSourceId).toBe(updated!.source.id);
    });

    it("approves a possible-duplicate by resolving to existing entity", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "possible-duplicate",
          targetEntityType: "event",
          targetEntityId: "event_some_existing",
          conflicts: {
            possibleMatches: ["event_some_existing"],
            matchReason: "Same venue, date, and headliner",
          },
        }),
      );

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      expect(result.reviewItem.status).toBe("approved");
      expect(result.publishedEntityId).toBe("event_some_existing");
      expect(result.publishedSourceId).toBeNull();
    });

    it("approves stale-task lane items", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "stale-task",
          targetEntityType: "event",
          targetEntityId: "event_stale",
          evidence: {
            sourceUrls: [],
            excerpts: [],
            contentHashes: [],
          },
        }),
      );

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      expect(result.reviewItem.status).toBe("approved");
      expect(result.publishedEntityId).toBe("event_stale");
    });

    it("approves source-health lane items", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "source-health",
          targetEntityType: "event",
          targetEntityId: null,
          evidence: {
            sourceUrls: [],
            excerpts: [],
            contentHashes: [],
          },
        }),
      );

      const result = await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      expect(result.reviewItem.status).toBe("approved");
    });

    it("records decision history on approval", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      const history = await refreshStore.listDecisionHistory(item.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].decision).toBe("approved");
      expect(history[0].reviewedBy).toBe("admin-secret");
    });

    it("records field-level decision history for proposed-update", async () => {
      const venue = await catalogStore.createVenue({
        id: "venue_smartbar",
        citySlug: "chicago",
        name: "Smartbar",
        slug: "smartbar",
        neighborhood: "Wrigleyville",
        address: "3730 N Clark St",
        capacity: 400,
        source: {
          id: "source_venue_smartbar",
          title: "Smartbar",
          url: "https://smartbarchicago.com",
          lastVerifiedAt: new Date().toISOString(),
        },
        signals: [],
      });

      const event = await catalogStore.createEvent({
        id: "event_test",
        citySlug: "chicago",
        title: "Test Event",
        slug: "test-event",
        startsAt: new Date().toISOString(),
        venue,
        artists: [],
        styles: [],
        source: {
          id: "source_event_test",
          title: "Test",
          url: "https://example.com",
          lastVerifiedAt: new Date().toISOString(),
        },
      });

      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "proposed-update",
          targetEntityId: event.id,
          fieldDiffs: {
            title: { current: "Test Event", proposed: "Updated Title" },
          },
          normalizedDraft: { title: "Updated Title" },
        }),
      );

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
        { acceptedFields: ["title"] },
      );

      const history = await refreshStore.listDecisionHistory(item.id);
      const fieldDecisions = history.filter(
        (h) => h.decision === "field-accepted",
      );
      expect(fieldDecisions).toHaveLength(1);
      expect(fieldDecisions[0].fieldName).toBe("title");
    });

    it("throws when approving an already-approved item", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret"),
      ).rejects.toThrow("already approved");
    });

    it("throws when approving an already-rejected item", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Not relevant",
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret"),
      ).rejects.toThrow("already rejected");
    });

    it("throws when review item is not found", async () => {
      await expect(
        approveReviewItem(
          refreshStore,
          catalogStore,
          "nonexistent",
          "admin-secret",
        ),
      ).rejects.toThrow("Review item not found");
    });

    it("throws when new-event is missing title", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            venueName: "Smartbar",
            venueSlug: "smartbar",
            startsAt: new Date().toISOString(),
          },
        }),
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret"),
      ).rejects.toThrow("event title is required");
    });

    it("throws when new-event is missing startsAt", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "No Date Event",
            venueName: "Smartbar",
            venueSlug: "smartbar",
          },
        }),
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret"),
      ).rejects.toThrow("event start date is required");
    });

    it("throws when new-event is missing venue name", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          normalizedDraft: {
            title: "No Venue Event",
            startsAt: new Date().toISOString(),
          },
          linkedDrafts: [],
        }),
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret"),
      ).rejects.toThrow("missing venue name");
    });

    it("throws for proposed-update with no accepted fields", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "proposed-update",
          targetEntityId: "event_some_id",
          fieldDiffs: {
            title: { current: "Old", proposed: "New" },
          },
        }),
      );

      await expect(
        approveReviewItem(refreshStore, catalogStore, item.id, "admin-secret", {
          acceptedFields: [],
        }),
      ).rejects.toThrow("At least one field must be accepted");
    });
  });

  // ─── rejectReviewItem ─────────────────────────────────────────────

  describe("rejectReviewItem", () => {
    it("rejects a review item with a reason", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const result = await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Duplicate entry",
        "Already in catalog under a different name",
      );

      expect(result.reviewItem.status).toBe("rejected");
      expect(result.reviewItem.rejectionReason).toBe("Duplicate entry");
      expect(result.reviewItem.reviewNotes).toBe(
        "Already in catalog under a different name",
      );
      expect(result.reviewItem.reviewedBy).toBe("admin-secret");
      expect(result.reviewItem.reviewedAt).not.toBeNull();
    });

    it("records decision history on rejection", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Spam source",
      );

      const history = await refreshStore.listDecisionHistory(item.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].decision).toBe("rejected");
      expect(history[0].reason).toBe("Spam source");
    });

    it("throws when rejection reason is empty", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await expect(
        rejectReviewItem(refreshStore, item.id, "admin-secret", "  "),
      ).rejects.toThrow("rejection reason is required");
    });

    it("throws when rejecting an already-rejected item", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "First rejection",
      );

      await expect(
        rejectReviewItem(
          refreshStore,
          item.id,
          "admin-secret",
          "Second attempt",
        ),
      ).rejects.toThrow("already rejected");
    });

    it("throws when rejecting an already-approved item", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await approveReviewItem(
        refreshStore,
        catalogStore,
        item.id,
        "admin-secret",
      );

      await expect(
        rejectReviewItem(
          refreshStore,
          item.id,
          "admin-secret",
          "Changed my mind",
        ),
      ).rejects.toThrow("already approved");
    });

    it("throws when review item is not found", async () => {
      await expect(
        rejectReviewItem(
          refreshStore,
          "nonexistent",
          "admin-secret",
          "reason",
        ),
      ).rejects.toThrow("Review item not found");
    });

    it("allows optional notes to be undefined", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      const result = await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Low confidence",
      );

      expect(result.reviewItem.status).toBe("rejected");
      expect(result.reviewItem.reviewNotes).toBeNull();
    });

    it("increments the source target rejection counter", async () => {
      const item = await refreshStore.createReviewItem(makeItem({}));

      await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Duplicate",
      );

      const target = await refreshStore.getSourceTarget("st_1");
      expect(target!.rejectionCount).toBe(1);
      expect(target!.failureCount).toBe(0);
      expect(target!.duplicateCount).toBe(0);
    });

    it("does not increment counters for stale tasks with no source target", async () => {
      const item = await refreshStore.createReviewItem(
        makeItem({
          lane: "stale-task",
          sourceTargetId: null,
          targetEntityType: "event",
          targetEntityId: "event_stale",
        }),
      );

      await rejectReviewItem(
        refreshStore,
        item.id,
        "admin-secret",
        "Already stale",
      );

      const target = await refreshStore.getSourceTarget("st_1");
      expect(target!.rejectionCount).toBe(0);
    });
  });
});
