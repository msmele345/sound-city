import { NextRequest } from "next/server";

import { POST as POSTAdminCatalog } from "@/app/api/admin/catalog/route";
import { GET as GETRefreshRuns } from "@/app/api/admin/refresh-runs/route";
import { GET as GETReviewItems } from "@/app/api/admin/review-items/route";
import {
  GET as GETSourceTargets,
  PATCH as PATCHSourceTarget,
  POST as POSTSourceTarget,
} from "@/app/api/admin/source-targets/route";
import { GET as GETCatalogEvents } from "@/app/api/catalog/events/route";
import { getRefreshStore } from "@/server/refresh/refresh-store";

import { GET } from "./route";

function requestFor(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return requestAt("/api/cron/refresh", init);
}

function requestAt(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

const emptyRunSummary = {
  sourceTargetsChecked: 0,
  sourceTargetsFailed: 0,
  draftsCreated: 0,
  updatesProposed: 0,
  duplicatesFlagged: 0,
  staleTasksCreated: 0,
  errorSummary: null,
};

async function persistedRunFor(runId: string) {
  const body = await refreshHistory();
  return body.runs.find((run: { id: string }) => run.id === runId);
}

async function refreshHistory() {
  const response = await GETRefreshRuns(
    requestAt("/api/admin/refresh-runs?city=chicago"),
  );
  return response.json();
}

async function updateSourceTarget(
  id: string,
  input: Record<string, unknown>,
) {
  const response = await PATCHSourceTarget(
    requestAt("/api/admin/source-targets", {
      method: "PATCH",
      body: JSON.stringify({ entity: "sourceTarget", id, input }),
    }),
  );
  if (!response.ok) {
    throw new Error(`Source target update failed with ${response.status}`);
  }
  return (await response.json()).target;
}

async function suspendEnabledDailyTargets() {
  const response = await GETSourceTargets(
    requestAt("/api/admin/source-targets?city=chicago"),
  );
  const targets = ((await response.json()).targets as Array<{
    id: string;
    enabled: boolean;
    refreshCadence: string;
  }>).filter(
    (target) => target.enabled && target.refreshCadence === "daily",
  );
  await Promise.all(
    targets.map((target) => updateSourceTarget(target.id, { enabled: false })),
  );

  return () =>
    Promise.all(
      targets.map((target) => updateSourceTarget(target.id, { enabled: true })),
    );
}

async function createDailyTarget(
  input: { name: string; parserStrategy: "dev-static" | "artist-social" },
) {
  const suffix = crypto.randomUUID();
  const ownerResponse = await POSTSourceTarget(
    requestAt("/api/admin/source-targets", {
      method: "POST",
      body: JSON.stringify({
        entity: "sourceOwner",
        input: {
          cityId: "city_chicago",
          name: input.name,
          slug: `cron-${input.parserStrategy}-${suffix}`,
          kind: "venue",
          notes: "",
        },
      }),
    }),
  );
  if (!ownerResponse.ok) {
    throw new Error(`Source owner creation failed with ${ownerResponse.status}`);
  }
  const { owner } = await ownerResponse.json();

  const targetResponse = await POSTSourceTarget(
    requestAt("/api/admin/source-targets", {
      method: "POST",
      body: JSON.stringify({
        entity: "sourceTarget",
        input: {
          ownerId: owner.id,
          cityId: "city_chicago",
          url: `https://fixtures.sound-city.test/${input.parserStrategy}/${suffix}`,
          sourceType:
            input.parserStrategy === "dev-static" ? "other" : "artist-social",
          parserStrategy: input.parserStrategy,
          trustLevel: "experimental",
          enabled: true,
          confidenceAdjustment: 0,
          healthStatus: "healthy",
          refreshCadence: "daily",
          notes: "",
        },
      }),
    }),
  );
  if (!targetResponse.ok) {
    throw new Error(`Source target creation failed with ${targetResponse.status}`);
  }
  return (await targetResponse.json()).target;
}

describe("Cron refresh route", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalAdminSecret = process.env.ADMIN_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_SECRET;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }

    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = originalAdminSecret;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("accepts only the exact Cron bearer credential before starting a refresh", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const store = getRefreshStore();
    const before = await store.listRefreshRuns("city_chicago");
    const priorRunIds = new Set(before.map((run) => run.id));

    const accepted = await GET(
      requestFor({
        headers: { authorization: "Bearer cron-route-test-secret" },
      }),
    );

    expect(accepted.status).toBe(200);

    const afterAccepted = await store.listRefreshRuns("city_chicago");
    const createdRun = afterAccepted.find((run) => !priorRunIds.has(run.id));
    expect(createdRun).toMatchObject({
      trigger: "scheduled",
      triggeredBy: "vercel-cron",
    });

    for (const authorization of [
      undefined,
      "Bearer wrong-secret",
      "bearer cron-route-test-secret",
      "cron-route-test-secret",
    ]) {
      const response = await GET(
        requestFor(
          authorization === undefined
            ? undefined
            : { headers: { authorization } },
        ),
      );

      expect(response.status, `authorization: ${authorization}`).toBe(401);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
      expect(
        (await store.listRefreshRuns("city_chicago")).map((run) => run.id),
      ).toEqual(afterAccepted.map((run) => run.id));
    }
  });

  it("waits for and returns a durable terminal scheduled run summary", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";

    const response = await GET(
      requestFor({
        headers: { authorization: "Bearer cron-route-test-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      runId: expect.stringMatching(/^refresh_run_/),
      status: "succeeded",
      trigger: "scheduled",
      triggeredBy: "vercel-cron",
      blockedByRunId: null,
      summary: emptyRunSummary,
    });
    await expect(persistedRunFor(body.runId)).resolves.toMatchObject({
      id: body.runId,
      status: "succeeded",
      trigger: "scheduled",
      triggeredBy: "vercel-cron",
      finishedAt: expect.any(String),
    });
  });

  it("returns success for a durably recorded skipped scheduled run", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const store = getRefreshStore();
    const active = await store.acquireRefreshLease({
      cityId: "city_chicago",
      trigger: "manual",
      triggeredBy: "admin-secret",
      acquiredAt: new Date().toISOString(),
    });
    expect(active.acquired).toBe(true);
    if (!active.acquired) {
      throw new Error("Expected the fixture lease to be acquired");
    }

    try {
      const response = await GET(
        requestFor({
          headers: { authorization: "Bearer cron-route-test-secret" },
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        runId: expect.stringMatching(/^refresh_run_/),
        status: "skipped",
        trigger: "scheduled",
        triggeredBy: "vercel-cron",
        blockedByRunId: active.run.id,
        summary: emptyRunSummary,
      });
      await expect(persistedRunFor(body.runId)).resolves.toMatchObject({
        id: body.runId,
        status: "skipped",
        trigger: "scheduled",
        triggeredBy: "vercel-cron",
        blockedByRunId: active.run.id,
        finishedAt: expect.any(String),
      });
    } finally {
      await store.releaseRefreshLease("city_chicago", active.run.id);
    }
  });

  it("returns a server error for a partial run without discarding successful target work", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const restoreExistingTargets = await suspendEnabledDailyTargets();
    const successfulTarget = await createDailyTarget({
      name: "Successful scheduled fixture",
      parserStrategy: "dev-static",
    });
    const failedTarget = await createDailyTarget({
      name: "Failed scheduled fixture",
      parserStrategy: "artist-social",
    });

    try {
      const response = await GET(
        requestFor({
          headers: { authorization: "Bearer cron-route-test-secret" },
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        runId: expect.stringMatching(/^refresh_run_/),
        status: "partial",
        trigger: "scheduled",
        triggeredBy: "vercel-cron",
        summary: {
          sourceTargetsChecked: 2,
          sourceTargetsFailed: 1,
          draftsCreated: 1,
          updatesProposed: 1,
          duplicatesFlagged: 1,
          staleTasksCreated: expect.any(Number),
          errorSummary: expect.stringMatching(/no parser is available/i),
        },
      });

      const history = await refreshHistory();
      expect(history.outcomesByRun[body.runId]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceTargetId: successfulTarget.id,
            status: "succeeded",
            candidateCount: 4,
            createdCount: 4,
          }),
          expect.objectContaining({
            sourceTargetId: failedTarget.id,
            status: "failed",
          }),
        ]),
      );
      expect(
        history.reviewItems.filter(
          (item: { runId: string; sourceTargetId: string | null }) =>
            item.runId === body.runId &&
            item.sourceTargetId === successfulTarget.id,
        ),
      ).toHaveLength(4);

      await updateSourceTarget(failedTarget.id, { enabled: false });
      const repeatedResponse = await GET(
        requestFor({
          headers: { authorization: "Bearer cron-route-test-secret" },
        }),
      );
      const repeatedBody = await repeatedResponse.json();
      expect(repeatedResponse.status).toBe(200);
      expect(repeatedBody).toMatchObject({ status: "succeeded" });

      const repeatedHistory = await refreshHistory();
      expect(repeatedHistory.outcomesByRun[repeatedBody.runId]).toEqual([
        expect.objectContaining({
          sourceTargetId: successfulTarget.id,
          status: "unchanged",
          candidateCount: 4,
          unchangedCount: 4,
          createdCount: 0,
        }),
      ]);
    } finally {
      await Promise.all([
        updateSourceTarget(successfulTarget.id, { enabled: false }),
        updateSourceTarget(failedTarget.id, { enabled: false }),
      ]);
      await restoreExistingTargets();
    }
  });

  it("returns a server error for a durably recorded failed run", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const restoreExistingTargets = await suspendEnabledDailyTargets();
    const failedTarget = await createDailyTarget({
      name: "All-failed scheduled fixture",
      parserStrategy: "artist-social",
    });

    try {
      const response = await GET(
        requestFor({
          headers: { authorization: "Bearer cron-route-test-secret" },
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        runId: expect.stringMatching(/^refresh_run_/),
        status: "failed",
        trigger: "scheduled",
        triggeredBy: "vercel-cron",
        summary: {
          sourceTargetsChecked: 1,
          sourceTargetsFailed: 1,
          errorSummary: expect.stringMatching(/no parser is available/i),
        },
      });

      const history = await refreshHistory();
      expect(
        history.runs.find((run: { id: string }) => run.id === body.runId),
      ).toMatchObject({
        id: body.runId,
        status: "failed",
        finishedAt: expect.any(String),
      });
      expect(history.outcomesByRun[body.runId]).toEqual([
        expect.objectContaining({
          sourceTargetId: failedTarget.id,
          status: "failed",
        }),
      ]);
    } finally {
      await updateSourceTarget(failedTarget.id, { enabled: false });
      await restoreExistingTargets();
    }
  });

  it("runs the review-only stale-task stage during scheduled refresh", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const suffix = crypto.randomUUID();
    const createdResponse = await POSTAdminCatalog(
      requestAt("/api/admin/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "event",
          input: {
            citySlug: "chicago",
            title: "Scheduled stale-task fixture",
            slug: `scheduled-stale-task-${suffix}`,
            startsAt: "2020-01-01T06:00:00.000Z",
            venueSlug: "smartbar",
            artistSlugs: [],
            styles: ["techno"],
            source: {
              title: "Scheduled stale-task fixture source",
              url: `https://fixtures.sound-city.test/stale/${suffix}`,
              lastVerifiedAt: "2026-08-08",
            },
          },
        }),
      }),
    );
    expect(createdResponse.status).toBe(201);
    const { event } = await createdResponse.json();

    const beforeResponse = await GETCatalogEvents(
      requestAt("/api/catalog/events?city=chicago"),
    );
    const before = (await beforeResponse.json()).events.find(
      (candidate: { id: string }) => candidate.id === event.id,
    );
    expect(before).toEqual(event);

    const response = await GET(
      requestFor({
        headers: { authorization: "Bearer cron-route-test-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "succeeded",
      trigger: "scheduled",
      summary: { staleTasksCreated: expect.any(Number) },
    });
    expect(body.summary.staleTasksCreated).toBeGreaterThan(0);

    const reviewResponse = await GETReviewItems(
      requestAt("/api/admin/review-items?city=chicago&lane=stale-task"),
    );
    const reviewItems = (await reviewResponse.json()).items;
    expect(reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: body.runId,
          lane: "stale-task",
          status: "pending",
          sourceTargetId: null,
          targetEntityId: event.id,
          normalizedDraft: expect.objectContaining({
            action: "review-past-event",
          }),
        }),
      ]),
    );

    const afterResponse = await GETCatalogEvents(
      requestAt("/api/catalog/events?city=chicago"),
    );
    const after = (await afterResponse.json()).events.find(
      (candidate: { id: string }) => candidate.id === event.id,
    );
    expect(after).toEqual(before);
  });

  it("rejects admin credentials and fails closed when credential domains overlap", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    process.env.ADMIN_SECRET = "admin-route-test-secret";
    const store = getRefreshStore();
    const before = await store.listRefreshRuns("city_chicago");

    const adminCredentialRequests: NonNullable<
      ConstructorParameters<typeof NextRequest>[1]
    >[] = [
      { headers: { authorization: "Bearer admin-route-test-secret" } },
      {
        headers: {
          "x-sound-city-admin-secret": "admin-route-test-secret",
        },
      },
    ];

    for (const init of adminCredentialRequests) {
      const response = await GET(requestFor(init));

      expect(response.status).toBe(401);
      expect(
        (await store.listRefreshRuns("city_chicago")).map((run) => run.id),
      ).toEqual(before.map((run) => run.id));
    }

    process.env.ADMIN_SECRET = process.env.CRON_SECRET;

    const response = await GET(
      requestFor({
        headers: { authorization: "Bearer cron-route-test-secret" },
      }),
    );

    expect(response.status).toBe(503);
    expect(
      (await store.listRefreshRuns("city_chicago")).map((run) => run.id),
    ).toEqual(before.map((run) => run.id));
  });

  it("ignores target and cadence query parameters when choosing scheduled work", async () => {
    process.env.CRON_SECRET = "cron-route-test-secret";
    const store = getRefreshStore();
    const owner = await store.createSourceOwner({
      cityId: "city_chicago",
      name: "Cron route target fixture",
      slug: `cron-route-target-${crypto.randomUUID()}`,
      kind: "venue",
      notes: "",
    });
    const createTarget = (input: { url: string; refreshCadence: string }) =>
      store.createSourceTarget({
        ownerId: owner.id,
        cityId: "city_chicago",
        url: input.url,
        sourceType: "other",
        parserStrategy: "dev-static",
        trustLevel: "experimental",
        enabled: true,
        confidenceAdjustment: 0,
        healthStatus: "healthy",
        refreshCadence: input.refreshCadence,
        notes: "",
      });
    const dailyTarget = await createTarget({
      url: "https://fixtures.sound-city.test/cron-daily",
      refreshCadence: "daily",
    });
    const manualTarget = await createTarget({
      url: "https://fixtures.sound-city.test/cron-manual",
      refreshCadence: "manual",
    });
    const priorRunIds = new Set(
      (await store.listRefreshRuns("city_chicago")).map((run) => run.id),
    );

    const response = await GET(
      requestAt(
        `/api/cron/refresh?targetId=${manualTarget.id}&targetIds=${manualTarget.id}&cadence=manual&refreshCadence=manual`,
        { headers: { authorization: "Bearer cron-route-test-secret" } },
      ),
    );

    expect(response.status).toBe(200);
    const run = (await store.listRefreshRuns("city_chicago")).find(
      (candidate) => !priorRunIds.has(candidate.id),
    );
    expect(run).toMatchObject({ sourceTargetsChecked: 1 });
    expect(await store.listRefreshTargetOutcomes(run!.id)).toEqual([
      expect.objectContaining({ sourceTargetId: dailyTarget.id }),
    ]);
    expect(await store.getSourceTarget(manualTarget.id)).toMatchObject({
      lastFetchedAt: null,
    });
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    const store = getRefreshStore();

    for (const configuredSecret of [undefined, "", " "]) {
      if (configuredSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = configuredSecret;
      }

      const before = await store.listRefreshRuns("city_chicago");
      const response = await GET(
        requestFor({ headers: { authorization: "Bearer undefined" } }),
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
      expect(
        (await store.listRefreshRuns("city_chicago")).map((run) => run.id),
      ).toEqual(before.map((run) => run.id));
    }
  });
});
