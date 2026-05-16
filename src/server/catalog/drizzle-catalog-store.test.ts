import { createDrizzleCatalogStore } from "./drizzle-catalog-store";

function table<T>(rows: T[]) {
  return {
    async findMany() {
      return rows;
    },
    async findFirst() {
      return rows[0];
    },
  };
}

describe("drizzle catalog store", () => {
  it("returns city-scoped events with venues, artists, and source provenance", async () => {
    const store = createDrizzleCatalogStore({
      query: {
        cities: table([
          {
            id: "city_chicago",
            name: "Chicago",
            slug: "chicago",
            timeZone: "America/Chicago",
          },
        ]),
        sources: table([
          {
            id: "source_smartbar",
            title: "smartbar listing",
            url: "https://example.com/smartbar",
            lastVerifiedAt: "2026-05-15",
          },
          {
            id: "source_artist",
            title: "artist listing",
            url: "https://example.com/artist",
            lastVerifiedAt: "2026-05-15",
          },
          {
            id: "source_event",
            title: "event listing",
            url: "https://example.com/event",
            lastVerifiedAt: "2026-05-15",
          },
        ]),
        venues: table([
          {
            id: "venue_smartbar",
            cityId: "city_chicago",
            sourceId: "source_smartbar",
            name: "smartbar",
            slug: "smartbar",
            neighborhood: "Wrigleyville",
            address: "3730 N Clark St",
            capacity: 400,
          },
        ]),
        artists: table([
          {
            id: "artist_selector",
            cityId: "city_chicago",
            sourceId: "source_artist",
            name: "Test Selector",
            slug: "test-selector",
            bio: "Chicago selector.",
            styles: ["house"],
            showcase: true,
          },
        ]),
        artistLinks: table([]),
        events: table([
          {
            id: "event_test_night",
            cityId: "city_chicago",
            venueId: "venue_smartbar",
            sourceId: "source_event",
            title: "Test Night",
            slug: "test-night",
            startsAt: "2026-05-22T02:00:00.000Z",
            styles: ["house"],
          },
        ]),
        eventArtists: table([
          {
            eventId: "event_test_night",
            artistId: "artist_selector",
          },
        ]),
        venueSignals: table([]),
      },
    });

    const events = await store.listEvents("chicago");

    expect(events).toEqual([
      expect.objectContaining({
        citySlug: "chicago",
        title: "Test Night",
        source: expect.objectContaining({
          url: "https://example.com/event",
        }),
        venue: expect.objectContaining({
          slug: "smartbar",
          source: expect.objectContaining({
            lastVerifiedAt: "2026-05-15",
          }),
        }),
        artists: [
          expect.objectContaining({
            slug: "test-selector",
            showcase: true,
          }),
        ],
      }),
    ]);
  });
});
