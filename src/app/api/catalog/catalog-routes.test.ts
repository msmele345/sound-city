import { NextRequest } from "next/server";

import { GET as getArtists } from "./artists/route";
import { GET as getEvents } from "./events/route";
import { GET as getShowcase } from "./showcase/route";
import { GET as getVenues } from "./venues/route";

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("catalog route handlers", () => {
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

  it("returns city-scoped Chicago events with source provenance", async () => {
    const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.city.slug).toBe("chicago");
    expect(body.events.length).toBeGreaterThanOrEqual(3);
    expect(body.events[0]).toMatchObject({
      citySlug: "chicago",
      source: {
        lastVerifiedAt: "2026-05-15",
      },
    });
    expect(body.events[0].venue.name).toEqual(expect.any(String));
    expect(body.events[0].artists.length).toBeGreaterThan(0);
  });

  it("returns venues, artists, and a weekly showcase from the catalog", async () => {
    const [venuesResponse, artistsResponse, showcaseResponse] = await Promise.all([
      getVenues(requestFor("/api/catalog/venues?city=chicago")),
      getArtists(requestFor("/api/catalog/artists?city=chicago")),
      getShowcase(requestFor("/api/catalog/showcase?city=chicago")),
    ]);

    const venues = await venuesResponse.json();
    const artists = await artistsResponse.json();
    const showcase = await showcaseResponse.json();

    expect(venues.venues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "smartbar",
          signals: expect.arrayContaining([
            expect.objectContaining({ category: "sound" }),
          ]),
        }),
      ]),
    );
    expect(artists.artists).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          links: expect.arrayContaining([
            expect.objectContaining({ kind: expect.any(String) }),
          ]),
        }),
      ]),
    );
    expect(showcase.artist).toMatchObject({
      citySlug: "chicago",
      showcase: true,
    });
  });
});
