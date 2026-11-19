import { NextRequest } from "next/server";

import { DELETE, GET as getAdminCatalog, POST } from "@/app/api/admin/catalog/route";

import { GET as getArtists } from "./artists/route";
import { GET as getEvents } from "./events/route";
import { GET as getShowcase } from "./showcase/route";
import { GET as getVenues } from "./venues/route";

function requestFor(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(path, "http://localhost:3000"), init);
}

function eventTitles(events: { title: string }[]) {
  return events.map((event) => event.title);
}

async function createChicagoEvent(input: {
  title: string;
  slug: string;
  startsAt: string;
}) {
  const response = await POST(
    requestFor("/api/admin/catalog", {
      method: "POST",
      body: JSON.stringify({
        entity: "event",
        input: {
          citySlug: "chicago",
          title: input.title,
          slug: input.slug,
          startsAt: input.startsAt,
          venueSlug: "smartbar",
          artistSlugs: ["posthuman"],
          styles: ["techno"],
          source: {
            title: `${input.title} listing`,
            url: `https://example.com/events/${input.slug}`,
            lastVerifiedAt: "2026-03-01",
          },
        },
      }),
    }),
  );
  const body = await response.json();
  if (response.status !== 201) {
    throw new Error(body.error ?? "event create failed");
  }
  return body.event as { id: string };
}

async function deleteChicagoEvent(id: string) {
  const response = await DELETE(
    requestFor("/api/admin/catalog", {
      method: "DELETE",
      body: JSON.stringify({ entity: "event", id }),
    }),
  );
  if (response.status !== 200) {
    throw new Error("event delete failed");
  }
}

describe("catalog route handlers", () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalFixtureFlag = process.env.SOUND_CITY_SCREENSHOT_FIXTURE;

  beforeEach(() => {
    delete process.env.ADMIN_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.SOUND_CITY_SCREENSHOT_FIXTURE;
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

    if (originalFixtureFlag === undefined) {
      delete process.env.SOUND_CITY_SCREENSHOT_FIXTURE;
    } else {
      process.env.SOUND_CITY_SCREENSHOT_FIXTURE = originalFixtureFlag;
    }

    vi.useRealTimers();
  });

  it("returns city-scoped Chicago events with source provenance", async () => {
    // Noon CDT on May 20, before every launch show. The real clock is later
    // than those dates, so this read has to pin "now" or the public filter
    // correctly returns an empty feed.
    vi.useFakeTimers({
      now: new Date("2026-05-20T17:00:00.000Z"),
      toFake: ["Date"],
    });

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

  it("keeps the future-dated screenshot fixture on the public feed", async () => {
    const now = new Date("2026-11-14T18:00:00.000Z");
    vi.useFakeTimers({ now, toFake: ["Date"] });
    process.env.SOUND_CITY_SCREENSHOT_FIXTURE = "1";

    const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
    const body = await response.json();
    const cutoff = now.getTime() - 6 * 60 * 60 * 1000;

    expect(response.status).toBe(200);
    expect(body.events.length).toBeGreaterThanOrEqual(8);
    expect(eventTitles(body.events)).toContain("Family Matters feat. Posthuman");
    expect(body.events.map((event: { startsAt: string }) => event.startsAt)).not.toContain(
      "2026-05-22T02:00:00.000Z",
    );
    expect(
      body.events.every((event: { startsAt: string }) => Date.parse(event.startsAt) > cutoff),
    ).toBe(true);
  });

  describe("events that have already finished their Chicago night", () => {
    // 7:00 AM CDT on May 22. Family Matters started at 9:00 PM CDT on May 21
    // (2026-05-22T02:00:00.000Z), ten hours earlier. Lemtom is still ahead.
    const sevenAmChicago = new Date("2026-05-22T12:00:00.000Z");

    afterEach(() => {
      vi.useRealTimers();
    });

    it("omits a show that started more than six Chicago hours ago and keeps a later one", async () => {
      vi.useFakeTimers({ now: sevenAmChicago, toFake: ["Date"] });

      const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(eventTitles(body.events)).not.toContain("Family Matters feat. Posthuman");
      expect(eventTitles(body.events)).toEqual(
        expect.arrayContaining(["Lemtom at Spybar", "Jeremy Olander Open-to-Close"]),
      );
    });

    it("keeps a show that is still in progress the same Chicago evening", async () => {
      // 11:00 PM CDT on May 21. Family Matters started at 9:00 PM that night.
      vi.useFakeTimers({
        now: new Date("2026-05-22T04:00:00.000Z"),
        toFake: ["Date"],
      });

      const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
      const body = await response.json();

      expect(eventTitles(body.events)).toContain("Family Matters feat. Posthuman");
    });

    it("keeps a show that started before midnight once Chicago is past midnight", async () => {
      // 1:00 AM CDT on May 22. The show's Chicago date is still May 21, and
      // its UTC timestamp is already May 22. It started four hours ago.
      vi.useFakeTimers({
        now: new Date("2026-05-22T06:00:00.000Z"),
        toFake: ["Date"],
      });

      const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
      const body = await response.json();

      expect(eventTitles(body.events)).toContain("Family Matters feat. Posthuman");
      expect(eventTitles(body.events)).toContain("Lemtom at Spybar");
    });

    it("treats a start exactly six Chicago hours ago as finished", async () => {
      // 3:00 AM CDT on May 22 is exactly six civil hours after 9:00 PM.
      vi.useFakeTimers({
        now: new Date("2026-05-22T08:00:00.000Z"),
        toFake: ["Date"],
      });

      const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
      const body = await response.json();

      expect(eventTitles(body.events)).not.toContain("Family Matters feat. Posthuman");
      expect(eventTitles(body.events)).toContain("Lemtom at Spybar");
    });

    it("keeps a late show after midnight once Chicago is on standard time", async () => {
      // 1:00 AM CST on Nov 15. The show started at 11:00 PM CST on Nov 14
      // (2026-11-15T05:00:00.000Z), two hours earlier, on the previous local date.
      vi.useFakeTimers({
        now: new Date("2026-11-15T07:00:00.000Z"),
        toFake: ["Date"],
      });
      const event = await createChicagoEvent({
        title: "Standard Time After Midnight",
        slug: "standard-time-after-midnight",
        startsAt: "2026-11-15T05:00:00.000Z",
      });

      try {
        const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
        const body = await response.json();

        expect(eventTitles(body.events)).toContain("Standard Time After Midnight");
        expect(eventTitles(body.events)).not.toContain("Family Matters feat. Posthuman");
      } finally {
        await deleteChicagoEvent(event.id);
      }
    });

    it("uses Chicago civil hours across the spring-forward gap", async () => {
      // 3:30 AM CDT on March 8. Six Chicago hours earlier is 9:30 PM CST,
      // only five elapsed hours earlier, because the clock skips 2:00 AM.
      // A start at that civil cutoff is finished. Elapsed-time math would keep it.
      vi.useFakeTimers({
        now: new Date("2026-03-08T08:30:00.000Z"),
        toFake: ["Date"],
      });
      const event = await createChicagoEvent({
        title: "Spring Forward Cutoff",
        slug: "spring-forward-cutoff",
        startsAt: "2026-03-08T03:30:00.000Z",
      });

      try {
        const response = await getEvents(requestFor("/api/catalog/events?city=chicago"));
        const body = await response.json();

        expect(eventTitles(body.events)).not.toContain("Spring Forward Cutoff");
      } finally {
        await deleteChicagoEvent(event.id);
      }
    });

    it("still returns that finished show from the admin catalog", async () => {
      vi.useFakeTimers({ now: sevenAmChicago, toFake: ["Date"] });

      const response = await getAdminCatalog(
        requestFor("/api/admin/catalog?city=chicago"),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(eventTitles(body.events)).toEqual(
        expect.arrayContaining([
          "Family Matters feat. Posthuman",
          "Lemtom at Spybar",
          "Jeremy Olander Open-to-Close",
        ]),
      );
    });
  });
});
