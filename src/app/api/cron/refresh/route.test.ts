import { NextRequest } from "next/server";

import { GET as GETRefreshRuns } from "@/app/api/admin/refresh-runs/route";
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
  const response = await GETRefreshRuns(
    requestAt("/api/admin/refresh-runs?city=chicago"),
  );
  const body = await response.json();
  return body.runs.find((run: { id: string }) => run.id === runId);
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
