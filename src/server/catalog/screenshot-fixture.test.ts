import { afterEach, describe, expect, it, vi } from "vitest";

import { getCatalogStore } from "./catalog-store";
import { launchCatalogData } from "./launch-data";
import {
  buildScreenshotCatalog,
  isScreenshotFixtureEnabled,
  selectCatalogMode,
} from "./screenshot-fixture";

const middayChicago = new Date("2026-11-14T18:00:00.000Z");

function chicagoCalendarDate(instant: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

describe("screenshot fixture gate", () => {
  it("stays off unless the flag is explicitly set", () => {
    expect(isScreenshotFixtureEnabled({})).toBe(false);
    expect(
      isScreenshotFixtureEnabled({ SOUND_CITY_SCREENSHOT_FIXTURE: "" }),
    ).toBe(false);
    expect(
      isScreenshotFixtureEnabled({ SOUND_CITY_SCREENSHOT_FIXTURE: "0" }),
    ).toBe(false);
    expect(
      isScreenshotFixtureEnabled({
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("stays off in production even when the flag is set", () => {
    expect(
      isScreenshotFixtureEnabled({
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        VERCEL_ENV: "production",
        NODE_ENV: "development",
      }),
    ).toBe(false);
    expect(
      isScreenshotFixtureEnabled({
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("stays off in preview even when the flag is set", () => {
    expect(
      isScreenshotFixtureEnabled({
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        VERCEL_ENV: "preview",
        NODE_ENV: "development",
      }),
    ).toBe(false);
  });
});

describe("screenshot fixture dates", () => {
  it("shifts launch events onto tonight, this week, and later in Chicago time", () => {
    const catalog = buildScreenshotCatalog(middayChicago);
    const startsAt = Object.fromEntries(
      catalog.events.map((event) => [event.title, event.startsAt]),
    );

    expect(startsAt["Family Matters feat. Posthuman"]).toBe(
      "2026-11-15T03:00:00.000Z",
    );
    expect(startsAt["Lemtom at Spybar"]).toBe("2026-11-17T04:00:00.000Z");
    expect(startsAt["Jeremy Olander Open-to-Close"]).toBe(
      "2026-11-23T04:00:00.000Z",
    );

    const dates = catalog.events.map((event) =>
      chicagoCalendarDate(event.startsAt),
    );
    expect(dates).toContain("2026-11-14");
    expect(dates.some((date) => date > "2026-11-14" && date <= "2026-11-20")).toBe(
      true,
    );
    expect(dates.some((date) => date >= "2026-11-21")).toBe(true);
    expect(
      catalog.events.every((event) => new Date(event.startsAt) > middayChicago),
    ).toBe(true);
    expect(
      catalog.events.find((event) => event.title === "Family Matters feat. Posthuman")
        ?.source.lastVerifiedAt,
    ).toBe("2026-05-15");
  });

  it("keeps Chicago wall-clock times during daylight saving", () => {
    const noonCdt = new Date("2026-07-15T17:00:00.000Z");
    const catalog = buildScreenshotCatalog(noonCdt);
    const family = catalog.events.find(
      (event) => event.title === "Family Matters feat. Posthuman",
    );

    expect(family?.startsAt).toBe("2026-07-16T02:00:00.000Z");
    expect(chicagoCalendarDate(family!.startsAt)).toBe("2026-07-15");
  });

  it("moves the schedule forward once tonight's earliest showtime is no longer ahead", () => {
    const atShowtime = new Date("2026-11-15T03:00:00.000Z");
    const catalog = buildScreenshotCatalog(atShowtime);
    const family = catalog.events.find(
      (event) => event.title === "Family Matters feat. Posthuman",
    );

    expect(family?.startsAt).toBe("2026-11-16T03:00:00.000Z");
    expect(
      catalog.events.every((event) => new Date(event.startsAt) > atShowtime),
    ).toBe(true);
    expect(
      catalog.events.every(
        (event) => chicagoCalendarDate(event.startsAt) >= "2026-11-15",
      ),
    ).toBe(true);
  });

  it("fills the feed, artist, venue, and saved views without changing launch dates", () => {
    const launchStarts = launchCatalogData.events.map((event) => event.startsAt);
    const catalog = buildScreenshotCatalog(middayChicago);

    expect(launchStarts).toEqual([
      "2026-05-22T02:00:00.000Z",
      "2026-05-24T03:00:00.000Z",
      "2026-05-30T03:00:00.000Z",
    ]);
    expect(
      launchStarts.every(
        (startsAt) => new Date(startsAt) < new Date("2026-11-14T00:00:00.000Z"),
      ),
    ).toBe(true);

    catalog.events[0].startsAt = "1999-01-01T00:00:00.000Z";
    expect(launchCatalogData.events.map((event) => event.startsAt)).toEqual(
      launchStarts,
    );

    expect(catalog.events.length).toBeGreaterThanOrEqual(8);
    expect(catalog.venues.length).toBeGreaterThanOrEqual(4);
    expect(catalog.artists.length).toBeGreaterThanOrEqual(5);
    expect(catalog.artists.filter((artist) => artist.showcase)).toHaveLength(1);
    expect(catalog.artists.every((artist) => artist.links.length > 0)).toBe(true);

    const eventsPerVenue = new Map<string, number>();
    for (const event of catalog.events) {
      eventsPerVenue.set(
        event.venue.slug,
        (eventsPerVenue.get(event.venue.slug) ?? 0) + 1,
      );
      expect(event.title).toBeTruthy();
      expect(event.venue.name).toBeTruthy();
      expect(event.venue.neighborhood).toBeTruthy();
      expect(event.source.url).toBeTruthy();
      expect(event.artists.length).toBeGreaterThan(0);
    }
    expect(Math.max(...eventsPerVenue.values())).toBeGreaterThanOrEqual(2);
    expect(new Set(catalog.events.flatMap((event) => event.styles)).size).toBeGreaterThanOrEqual(
      4,
    );
  });
});

describe("getCatalogStore screenshot fixture", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalFixtureFlag = process.env.SOUND_CITY_SCREENSHOT_FIXTURE;

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
    restoreEnv("VERCEL_ENV", originalVercelEnv);
    restoreEnv("SOUND_CITY_SCREENSHOT_FIXTURE", originalFixtureFlag);
  });

  it("serves the May 2026 launch catalog when the fixture is off", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.SOUND_CITY_SCREENSHOT_FIXTURE;
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "development");

    const events = await getCatalogStore().listEvents("chicago");

    expect(events.map((event) => event.startsAt)).toEqual([
      "2026-05-22T02:00:00.000Z",
      "2026-05-24T03:00:00.000Z",
      "2026-05-30T03:00:00.000Z",
    ]);
  });

  it("serves shifted upcoming events when the fixture is on", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "development");
    process.env.SOUND_CITY_SCREENSHOT_FIXTURE = "1";

    const before = Date.now();
    const events = await getCatalogStore().listEvents("chicago");

    expect(events.length).toBeGreaterThan(3);
    expect(events.map((event) => event.startsAt)).not.toContain(
      "2026-05-22T02:00:00.000Z",
    );
    expect(events.every((event) => Date.parse(event.startsAt) > before)).toBe(
      true,
    );
  });

  it("keeps the launch catalog in production and preview", async () => {
    delete process.env.DATABASE_URL;
    process.env.SOUND_CITY_SCREENSHOT_FIXTURE = "1";

    for (const vercelEnv of ["production", "preview"] as const) {
      process.env.VERCEL_ENV = vercelEnv;
      vi.stubEnv("NODE_ENV", "production");
      const events = await getCatalogStore().listEvents("chicago");
      expect(events[0]?.startsAt).toBe("2026-05-22T02:00:00.000Z");
    }
  });

  it("prefers the database whenever DATABASE_URL is set", () => {
    expect(
      selectCatalogMode({
        DATABASE_URL: "postgres://local-only-example",
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        NODE_ENV: "development",
      }),
    ).toBe("database");
    expect(
      selectCatalogMode({
        NODE_ENV: "development",
      }),
    ).toBe("launch");
    expect(
      selectCatalogMode({
        SOUND_CITY_SCREENSHOT_FIXTURE: "1",
        NODE_ENV: "development",
      }),
    ).toBe("screenshot-fixture");
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
