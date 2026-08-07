import { NextRequest } from "next/server";

import { getRefreshStore } from "@/server/refresh/refresh-store";

import { GET } from "./route";

function requestFor(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL("/api/cron/refresh", "http://localhost:3000"), init);
}

describe("Cron refresh route", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
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
