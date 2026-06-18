import { NextRequest } from "next/server";

import { DELETE, GET, PATCH, POST } from "./route";

function requestFor(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

async function createOwner(name: string, slug: string) {
  const response = await POST(
    requestFor("/api/admin/source-targets", {
      method: "POST",
      body: JSON.stringify({
        entity: "sourceOwner",
        input: {
          cityId: "city_chicago",
          name,
          slug,
          kind: "venue",
          notes: "",
        },
      }),
    }),
  );
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  expect(body.owner, JSON.stringify(body)).toBeDefined();
  return body.owner as { id: string; name: string; kind: string };
}

describe("admin source-targets route handlers", () => {
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

  it("requires the configured admin secret before serving refresh source routes", async () => {
    process.env.ADMIN_SECRET = "phase-two-secret";

    const blocked = await GET(
      requestFor("/api/admin/source-targets?city=chicago"),
    );
    expect(blocked.status).toBe(401);
    expect(await blocked.json()).toMatchObject({
      error: expect.stringMatching(/admin secret/i),
    });

    const allowed = await GET(
      requestFor("/api/admin/source-targets?city=chicago", {
        headers: { "x-sound-city-admin-secret": "phase-two-secret" },
      }),
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      owners: expect.any(Array),
      targets: expect.any(Array),
    });
  });

  it("creates owners and targets, groups them, toggles, and deletes", async () => {
    const owner = await createOwner("smartbar", "smartbar");
    expect(owner).toMatchObject({ name: "smartbar", kind: "venue" });

    const targetResponse = await POST(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceTarget",
          input: {
            cityId: "city_chicago",
            ownerId: owner.id,
            url: "https://smartbarchicago.com/calendar",
            sourceType: "official-venue-calendar",
            parserStrategy: "venue-calendar",
            trustLevel: "primary",
            enabled: true,
            confidenceAdjustment: 0,
            healthStatus: "healthy",
            refreshCadence: "daily",
            notes: "",
          },
        }),
      }),
    );
    const targetBody = await targetResponse.json();
    expect(targetResponse.status).toBe(201);
    expect(targetBody.target).toMatchObject({
      ownerId: owner.id,
      parserStrategy: "venue-calendar",
      enabled: true,
    });

    const listResponse = await GET(
      requestFor("/api/admin/source-targets?city=chicago"),
    );
    const listBody = await listResponse.json();
    expect(listBody.owners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: owner.id }),
      ]),
    );
    expect(listBody.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: targetBody.target.id }),
      ]),
    );

    const disableResponse = await PATCH(
      requestFor("/api/admin/source-targets", {
        method: "PATCH",
        body: JSON.stringify({
          entity: "sourceTarget",
          id: targetBody.target.id,
          input: { enabled: false },
        }),
      }),
    );
    expect(disableResponse.status).toBe(200);
    expect((await disableResponse.json()).target.enabled).toBe(false);

    const deleteTarget = await DELETE(
      requestFor("/api/admin/source-targets", {
        method: "DELETE",
        body: JSON.stringify({
          entity: "sourceTarget",
          id: targetBody.target.id,
        }),
      }),
    );
    expect(deleteTarget.status).toBe(200);
    expect(await deleteTarget.json()).toEqual({ ok: true });

    const deleteOwner = await DELETE(
      requestFor("/api/admin/source-targets", {
        method: "DELETE",
        body: JSON.stringify({
          entity: "sourceOwner",
          id: owner.id,
        }),
      }),
    );
    expect(deleteOwner.status).toBe(200);
    expect(await deleteOwner.json()).toEqual({ ok: true });
  });

  it("rejects a target with an invalid URL", async () => {
    const owner = await createOwner("Podlasie Club", "podlasie-club");

    const invalid = await POST(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceTarget",
          input: {
            cityId: "city_chicago",
            ownerId: owner.id,
            url: "not-a-url",
            sourceType: "official-venue-calendar",
            parserStrategy: "venue-calendar",
            trustLevel: "primary",
            enabled: true,
            confidenceAdjustment: 0,
            healthStatus: "healthy",
            refreshCadence: "daily",
            notes: "",
          },
        }),
      }),
    );

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: expect.stringMatching(/valid url/i),
    });
  });

  it("creates an enabled RSS event feed source target", async () => {
    const owner = await createOwner("RSS Smartbar", "rss-smartbar");

    const response = await POST(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceTarget",
          input: {
            cityId: "city_chicago",
            ownerId: owner.id,
            url: "https://smartbarchicago.com/events/feed/",
            sourceType: "official-venue-calendar",
            parserStrategy: "rss-event-feed",
            trustLevel: "primary",
            enabled: true,
            confidenceAdjustment: 0,
            healthStatus: "healthy",
            refreshCadence: "daily",
            notes: "",
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect((await response.json()).target).toMatchObject({
      ownerId: owner.id,
      parserStrategy: "rss-event-feed",
      sourceType: "official-venue-calendar",
      enabled: true,
    });
  });

  it("rejects the dev-static parser strategy in production", async () => {
    process.env.VERCEL_ENV = "production";

    const owner = await createOwner("Prod Owner", "prod-owner");
    const blocked = await POST(
      requestFor("/api/admin/source-targets", {
        method: "POST",
        body: JSON.stringify({
          entity: "sourceTarget",
          input: {
            cityId: "city_chicago",
            ownerId: owner.id,
            url: "https://example.com/fixture",
            sourceType: "other",
            parserStrategy: "dev-static",
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

    expect(blocked.status).toBe(400);
    expect(await blocked.json()).toMatchObject({
      error: expect.stringMatching(/dev-static/i),
    });
  });
});
