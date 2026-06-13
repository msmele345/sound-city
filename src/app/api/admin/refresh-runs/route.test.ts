import { NextRequest } from "next/server";

import { GET, POST } from "./route";
import { POST as POSTSourceTargets } from "../source-targets/route";

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
});
