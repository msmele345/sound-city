import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as CatalogOps from "../catalog/operations";
import * as schema from "../db/schema";
import { approveReviewItem, type ApprovalTransaction } from "./review-operations";
import { createReviewStoreBundle, type ReviewStoreBundle } from "./review-store-bundle";
import type { CreateReviewItemInput } from "./types";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("review approval PostgreSQL integration", () => {
  const suffix = randomUUID().slice(0, 8);
  const venueSlug = `approval-test-${suffix}`;
  const eventTitle = `Approval Test ${suffix}`;
  const eventSlug = eventTitle.toLowerCase().replaceAll(" ", "-");
  const eventId = `event_${eventSlug.replaceAll("-", "_")}`;
  const venueId = `venue_${venueSlug.replaceAll("-", "_")}`;
  const venueSourceId = `source_venue_${venueSlug}`;
  const eventSourceId = `source_event_${eventSlug}`;
  const client = postgres(testDatabaseUrl!, { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  let bundle: ReviewStoreBundle;
  let runId: string;
  const reviewItemIds: string[] = [];

  function reviewInput(fingerprint: string): CreateReviewItemInput {
    const timestamp = new Date().toISOString();
    return {
      cityId: "city_chicago",
      runId,
      sourceTargetId: null,
      lane: "new-event",
      priority: 80,
      confidence: 90,
      confidenceReasons: ["database integration test"],
      targetEntityType: "event",
      targetEntityId: null,
      matchFingerprint: fingerprint,
      normalizedDraft: {
        title: eventTitle,
        venueName: eventTitle,
        venueSlug,
        startsAt: "2030-06-19T04:00:00.000Z",
        styles: ["house"],
      },
      fieldDiffs: null,
      linkedDrafts: [],
      conflicts: null,
      evidence: {
        sourceUrls: [`https://fixtures.sound-city.test/${suffix}`],
        excerpts: [eventTitle],
        contentHashes: [fingerprint],
      },
      parserVersion: "db-test@1",
      fetchTimestamp: timestamp,
    };
  }

  beforeAll(async () => {
    bundle = createReviewStoreBundle(
      db as Parameters<typeof createReviewStoreBundle>[0],
    );
    await db
      .insert(schema.cities)
      .values({
        id: "city_chicago",
        name: "Chicago",
        slug: "chicago",
        timeZone: "America/Chicago",
      })
      .onConflictDoNothing();
    await CatalogOps.createVenue(bundle.catalogStore, {
      citySlug: "chicago",
      name: eventTitle,
      slug: venueSlug,
      neighborhood: "Test",
      address: "Test",
      capacity: null,
      source: {
        title: eventTitle,
        url: `https://fixtures.sound-city.test/${suffix}/venue`,
        lastVerifiedAt: new Date().toISOString(),
      },
    });
    const run = await bundle.refreshStore.createRefreshRun({
      cityId: "city_chicago",
      trigger: "manual",
      triggeredBy: "db-test",
    });
    runId = run.id;
  });

  afterAll(async () => {
    for (const reviewItemId of reviewItemIds) {
      await db
        .delete(schema.reviewDecisionHistory)
        .where(eq(schema.reviewDecisionHistory.reviewItemId, reviewItemId));
      await db
        .delete(schema.reviewItems)
        .where(eq(schema.reviewItems.id, reviewItemId));
    }
    await db.delete(schema.refreshRuns).where(eq(schema.refreshRuns.id, runId));
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
    await db.delete(schema.venues).where(eq(schema.venues.id, venueId));
    await db
      .delete(schema.sources)
      .where(eq(schema.sources.id, eventSourceId));
    await db
      .delete(schema.sources)
      .where(eq(schema.sources.id, venueSourceId));
    await client.end();
  });

  it("reconciles repeated approvals without inserting a duplicate event", async () => {
    const first = await bundle.refreshStore.createReviewItem(
      reviewInput(`db-first-${suffix}`),
    );
    const second = await bundle.refreshStore.createReviewItem(
      reviewInput(`db-second-${suffix}`),
    );
    reviewItemIds.push(first.id, second.id);

    await approveReviewItem(
      bundle.refreshStore,
      bundle.catalogStore,
      first.id,
      "db-test",
      {},
      bundle.withTransaction,
    );
    const result = await approveReviewItem(
      bundle.refreshStore,
      bundle.catalogStore,
      second.id,
      "db-test",
      {},
      bundle.withTransaction,
    );

    expect(result.publishedEntityId).toBe(eventId);
    expect(
      (await bundle.catalogStore.listEvents("chicago")).filter(
        (event) => event.id === eventId,
      ),
    ).toHaveLength(1);
  });

  it("rolls back catalog publication when the review update fails", async () => {
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
    const item = await bundle.refreshStore.createReviewItem(
      reviewInput(`db-rollback-${suffix}`),
    );
    reviewItemIds.push(item.id);
    const failingTransaction: ApprovalTransaction = (callback) =>
      bundle.withTransaction((refreshStore, catalogStore) =>
        callback(
          {
            ...refreshStore,
            async updateReviewItem() {
              throw new Error("forced review update failure");
            },
          },
          catalogStore,
        ),
      );

    await expect(
      approveReviewItem(
        bundle.refreshStore,
        bundle.catalogStore,
        item.id,
        "db-test",
        {},
        failingTransaction,
      ),
    ).rejects.toThrow("forced review update failure");

    expect(
      (await bundle.catalogStore.listEvents("chicago")).some(
        (event) => event.id === eventId,
      ),
    ).toBe(false);
    expect((await bundle.refreshStore.getReviewItem(item.id))?.status).toBe(
      "pending",
    );
  });
});
