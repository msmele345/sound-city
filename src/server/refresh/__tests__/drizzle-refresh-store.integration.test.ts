import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "../../db/schema";
import { createDrizzleRefreshStore } from "../drizzle-refresh-store";
import type { RefreshStore } from "../refresh-store";
import type { CreateReviewItemInput } from "../types";

const connectionString = process.env.TEST_DATABASE_URL;

function reviewItemInput(
  runId: string,
  sourceTargetId: string,
): CreateReviewItemInput {
  return {
    cityId: "city_chicago",
    runId,
    sourceTargetId,
    lane: "new-event",
    priority: 50,
    confidence: 80,
    confidenceReasons: ["official source"],
    targetEntityType: "event",
    targetEntityId: null,
    matchFingerprint: "event-42:2026-07-12t03-00-00-000z:smartbar",
    normalizedDraft: {
      title: "Warehouse Night",
      startsAt: "2026-07-12T03:00:00.000Z",
      venueName: "Smartbar",
    },
    fieldDiffs: null,
    linkedDrafts: [],
    conflicts: null,
    evidence: {
      sourceUrls: ["https://smartbarchicago.com/event/42"],
      excerpts: ["Warehouse Night"],
      contentHashes: ["content-42"],
    },
    parserVersion: "rss-event-feed@1",
    fetchTimestamp: "2026-07-11T12:00:00.000Z",
  };
}

describe.skipIf(!connectionString)(
  "drizzle refresh store PostgreSQL transactions",
  () => {
    let clients: ReturnType<typeof postgres>[] = [];
    let stores: RefreshStore[] = [];

    beforeAll(async () => {
      clients = [
        postgres(connectionString!, { max: 1, prepare: false }),
        postgres(connectionString!, { max: 1, prepare: false }),
      ];
      const databases = clients.map((client) => drizzle(client, { schema }));
      await migrate(databases[0], { migrationsFolder: "db/migrations" });
      stores = databases.map((database) =>
        createDrizzleRefreshStore(database),
      );
    });

    beforeEach(async () => {
      await clients[0].unsafe(`
        TRUNCATE TABLE
          source_event_observations,
          review_decision_history,
          review_items,
          refresh_run_logs,
          refresh_runs,
          source_targets,
          source_owners
        CASCADE
      `);
      await clients[0].unsafe(`
        INSERT INTO cities (id, name, slug, time_zone)
        VALUES ('city_chicago', 'Chicago', 'chicago', 'America/Chicago')
        ON CONFLICT (id) DO NOTHING
      `);
    });

    afterAll(async () => {
      await Promise.all(clients.map((client) => client.end()));
    });

    async function createTargetAndRuns() {
      const owner = await stores[0].createSourceOwner({
        cityId: "city_chicago",
        name: "Smartbar",
        slug: "smartbar-ac9",
        kind: "venue",
        notes: "",
      });
      const target = await stores[0].createSourceTarget({
        ownerId: owner.id,
        cityId: "city_chicago",
        url: "https://smartbarchicago.com/events/feed/",
        sourceType: "official-venue-calendar",
        parserStrategy: "rss-event-feed",
        trustLevel: "primary",
        enabled: true,
        confidenceAdjustment: 0,
        healthStatus: "healthy",
        refreshCadence: "manual",
        notes: "",
      });
      const runs = await Promise.all(
        stores.map((store, index) =>
          store.createRefreshRun({
            cityId: "city_chicago",
            trigger: "manual",
            triggeredBy: `admin-secret-${index}`,
          }),
        ),
      );
      return { target, runs };
    }

    it("serializes concurrent classification and creates one review item", async () => {
      const { target, runs } = await createTargetAndRuns();
      const classify = (store: RefreshStore, runId: string) =>
        store.withSourceEventObservationTransaction(
          target.id,
          "event-42",
          async (transactionStore) => {
            const existing = await transactionStore.getSourceEventObservation(
              target.id,
              "event-42",
            );
            if (existing) {
              await transactionStore.updateSourceEventObservation(existing.id, {
                lastSeenAt: "2026-07-11T12:00:01.000Z",
              });
              return null;
            }

            const item = await transactionStore.createReviewItem(
              reviewItemInput(runId, target.id),
            );
            await transactionStore.createSourceEventObservation({
              sourceTargetId: target.id,
              sourceEventKey: "event-42",
              matchFingerprint: item.matchFingerprint,
              materialContentHash: "a".repeat(64),
              normalizedCandidate: item.normalizedDraft,
              seenAt: item.fetchTimestamp,
              latestReviewItemId: item.id,
              publishedEventId: null,
              parserVersion: item.parserVersion,
            });
            return item;
          },
        );

      const results = await Promise.all([
        classify(stores[0], runs[0].id),
        classify(stores[1], runs[1].id),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      const items = await stores[0].listReviewItems("city_chicago");
      expect(items).toHaveLength(1);
      await expect(
        stores[0].getSourceEventObservation(target.id, "event-42"),
      ).resolves.toMatchObject({ latestReviewItemId: items[0].id });
    });

    it("rolls back review-item and observation writes together", async () => {
      const { target, runs } = await createTargetAndRuns();

      await expect(
        stores[0].withSourceEventObservationTransaction(
          target.id,
          "event-rollback",
          async (transactionStore) => {
            const item = await transactionStore.createReviewItem(
              reviewItemInput(runs[0].id, target.id),
            );
            await transactionStore.createSourceEventObservation({
              sourceTargetId: target.id,
              sourceEventKey: "event-rollback",
              matchFingerprint: item.matchFingerprint,
              materialContentHash: "b".repeat(64),
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

      await expect(stores[0].listReviewItems("city_chicago")).resolves.toEqual(
        [],
      );
      await expect(
        stores[0].getSourceEventObservation(target.id, "event-rollback"),
      ).resolves.toBeNull();
    });
  },
);
