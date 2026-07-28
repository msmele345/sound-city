import { NextRequest } from "next/server";

import { GET, POST } from "./route";
import { getRefreshStore } from "@/server/refresh/refresh-store";
import {
  GET as GETSourceTargets,
  PATCH as PATCHSourceTargets,
  POST as POSTSourceTargets,
} from "../source-targets/route";

function requestFor(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

async function createDevSourceTarget() {
  const ownerResponse = await POSTSourceTargets(
    requestFor("/api/admin/source-targets", {
      method: "POST",
      body: JSON.stringify({
        entity: "sourceOwner",
        input: {
          cityId: "city_chicago",
          name: "Fixture Runner",
          slug: `fixture-runner-${Date.now()}`,
          kind: "venue",
          notes: "",
        },
      }),
    }),
  );
  const ownerBody = await ownerResponse.json();
  expect(ownerResponse.status, JSON.stringify(ownerBody)).toBe(201);
  expect(ownerBody.owner, JSON.stringify(ownerBody)).toBeDefined();

  const targetResponse = await POSTSourceTargets(
    requestFor("/api/admin/source-targets", {
      method: "POST",
      body: JSON.stringify({
        entity: "sourceTarget",
        input: {
          cityId: "city_chicago",
          ownerId: ownerBody.owner.id,
          url: `https://fixtures.sound-city.test/dev-static/${Date.now()}`,
          sourceType: "other",
          parserStrategy: "dev-static",
          trustLevel: "experimental",
          enabled: true,
          confidenceAdjustment: 0,
          healthStatus: "healthy",
          refreshCadence: "manual",
          notes: "",
        },
      }),
    }),
  );

  expect(targetResponse.status).toBe(201);
}

describe("admin refresh-runs route handlers", () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    delete process.env.ADMIN_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    if (originalAdminSecret) {
      process.env.ADMIN_SECRET = originalAdminSecret;
    } else {
      delete process.env.ADMIN_SECRET;
    }
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalVercelEnv) {
      process.env.VERCEL_ENV = originalVercelEnv;
    } else {
      delete process.env.VERCEL_ENV;
    }
  });

  it("requires the configured admin secret for manual refreshes", async () => {
    process.env.ADMIN_SECRET = "phase-three-secret";

    const blocked = await POST(
      requestFor("/api/admin/refresh-runs", { method: "POST" }),
    );

    expect(blocked.status).toBe(401);
    expect(await blocked.json()).toMatchObject({
      error: expect.stringMatching(/admin secret/i),
    });
  });

  it("returns conflict with the active run when a manual refresh overlaps", async () => {
    const citySlug = `refresh-conflict-${Date.now()}`;
    const cityId = `city_${citySlug.replaceAll("-", "_")}`;
    const store = getRefreshStore();
    const active = await store.acquireRefreshLease({
      cityId,
      trigger: "scheduled",
      triggeredBy: "vercel-cron",
      acquiredAt: "2026-07-27T12:00:00.000Z",
    });
    expect(active.acquired).toBe(true);
    if (!active.acquired) {
      throw new Error("Expected the fixture lease to be acquired");
    }

    try {
      const response = await POST(
        requestFor(`/api/admin/refresh-runs?city=${citySlug}`, {
          method: "POST",
        }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Refresh already active",
        activeRunId: active.run.id,
      });
    } finally {
      await store.releaseRefreshLease(cityId, active.run.id);
    }
  });

  it("runs a manual dev refresh and reads durable review lanes and logs", async () => {
    await createDevSourceTarget();

    const created = await POST(
      requestFor("/api/admin/refresh-runs", { method: "POST" }),
    );
    const createdBody = await created.json();

    expect(created.status).toBe(201);
    expect(createdBody.run).toMatchObject({
      status: "succeeded",
      draftsCreated: expect.any(Number),
      updatesProposed: expect.any(Number),
      duplicatesFlagged: expect.any(Number),
      staleTasksCreated: expect.any(Number),
    });
    expect(createdBody.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lane: "new-event" }),
        expect.objectContaining({ lane: "proposed-update" }),
        expect.objectContaining({ lane: "possible-duplicate" }),
        expect.objectContaining({ lane: "stale-task" }),
      ]),
    );
    expect(createdBody.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringMatching(/refresh run started/i),
        }),
      ]),
    );
    const listed = await GET(
      requestFor("/api/admin/refresh-runs?city=chicago"),
    );
    const listedBody = await listed.json();

    expect(listed.status).toBe(200);
    expect(listedBody.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdBody.run.id, status: "succeeded" }),
      ]),
    );
    expect(listedBody.logsByRun[createdBody.run.id]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringMatching(/refresh run completed/i),
        }),
      ]),
    );
    expect(listedBody.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId: createdBody.run.id }),
      ]),
    );
  });

  it("exposes target outcomes for a manual run and run history", async () => {
    await createDevSourceTarget();

    const created = await POST(
      requestFor("/api/admin/refresh-runs", { method: "POST" }),
    );
    const createdBody = await created.json();

    expect(createdBody.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: createdBody.run.id,
          status: expect.stringMatching(/succeeded|unchanged/),
        }),
      ]),
    );

    const listed = await GET(
      requestFor("/api/admin/refresh-runs?city=chicago"),
    );
    const listedBody = await listed.json();

    expect(listedBody.outcomesByRun[createdBody.run.id]).toEqual(
      createdBody.outcomes,
    );
  });

  it("exposes persisted failure and recovery health transitions end to end", async () => {
    const citySlug = `health-route-${Date.now()}`;
    const cityId = `city_${citySlug.replaceAll("-", "_")}`;
    const ownerResponse = await POSTSourceTargets(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceOwner",
          input: {
            cityId,
            name: "Route Health Source",
            slug: citySlug,
            kind: "venue",
            notes: "",
          },
        }),
      }),
    );
    const owner = (await ownerResponse.json()).owner;
    const targetResponse = await POSTSourceTargets(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceTarget",
          input: {
            cityId,
            ownerId: owner.id,
            url: `https://route-health.test/${citySlug}`,
            sourceType: "official-venue-calendar",
            parserStrategy: "artist-social",
            trustLevel: "primary",
            enabled: true,
            confidenceAdjustment: 9,
            healthStatus: "healthy",
            refreshCadence: "daily",
            notes: "",
          },
        }),
      }),
    );
    const target = (await targetResponse.json()).target;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await POST(
        requestFor(`/api/admin/refresh-runs?city=${citySlug}`, {
          method: "POST",
        }),
      );
      expect((await failed.json()).run.status).toBe("failed");
    }

    let sources = await GETSourceTargets(
      requestFor(`/api/admin/source-targets?city=${citySlug}`),
    );
    let sourceBody = await sources.json();
    expect(sourceBody.targets[0]).toMatchObject({
      id: target.id,
      healthStatus: "failing",
      enabled: true,
      trustLevel: "primary",
      confidenceAdjustment: 9,
    });
    expect(sourceBody.healthByTarget[target.id]).toMatchObject({
      status: "failing",
      consecutiveFailures: 4,
    });

    await PATCHSourceTargets(
      requestFor("/api/admin/source-targets", {
        method: "PATCH",
        body: JSON.stringify({
          entity: "sourceTarget",
          id: target.id,
          input: { parserStrategy: "dev-static" },
        }),
      }),
    );
    const firstRecovery = await POST(
      requestFor(`/api/admin/refresh-runs?city=${citySlug}`, {
        method: "POST",
      }),
    );
    expect((await firstRecovery.json()).outcomes[0].status).toBe("succeeded");

    sources = await GETSourceTargets(
      requestFor(`/api/admin/source-targets?city=${citySlug}`),
    );
    sourceBody = await sources.json();
    expect(sourceBody.targets[0].healthStatus).toBe("degraded");

    const secondRecovery = await POST(
      requestFor(`/api/admin/refresh-runs?city=${citySlug}`, {
        method: "POST",
      }),
    );
    expect((await secondRecovery.json()).outcomes[0].status).toBe("unchanged");

    sources = await GETSourceTargets(
      requestFor(`/api/admin/source-targets?city=${citySlug}`),
    );
    sourceBody = await sources.json();
    expect(sourceBody.targets[0]).toMatchObject({
      healthStatus: "healthy",
      enabled: true,
      trustLevel: "primary",
      confidenceAdjustment: 9,
    });
    expect(sourceBody.healthByTarget[target.id]).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
      consecutiveSuccesses: 2,
    });
  });
});
