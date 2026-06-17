import {
  defaultTasteProfile,
  rankRecommendedEvents,
  type RecommendationEvent,
} from "./recommendations";

const source = {
  id: "source_test",
  title: "Verified listing",
  url: "https://example.com/event",
  lastVerifiedAt: "2026-05-15",
};

function event(overrides: Partial<RecommendationEvent>): RecommendationEvent {
  return {
    id: "event_test",
    title: "Test Event",
    startsAt: "2026-05-23T03:00:00.000Z",
    venue: {
      name: "Podlasie Club",
      neighborhood: "Avondale",
      capacity: 220,
    },
    artists: [{ name: "Local Selector", slug: "local-selector" }],
    styles: ["house"],
    source,
    ...overrides,
  };
}

describe("rankRecommendedEvents", () => {
  it("prioritizes taste matches and filters dismissed or attended events", () => {
    const recommendations = rankRecommendedEvents(
      [
        event({
          id: "event_fit",
          title: "Small Room Acid Night",
          styles: ["acid", "techno"],
          venue: {
            name: "Podlasie Club",
            neighborhood: "Avondale",
            capacity: 220,
          },
        }),
        event({
          id: "event_mainstream",
          title: "River North House Night",
          styles: ["house"],
          venue: {
            name: "Large Room",
            neighborhood: "River North",
            capacity: 900,
          },
        }),
        event({ id: "event_dismissed", title: "Dismissed Techno" }),
        event({ id: "event_attended", title: "Already Attended" }),
      ],
      {
        profile: {
          ...defaultTasteProfile,
          styles: ["acid", "techno"],
          vibe: "raw",
          venueSize: "small-room",
          startTime: "late",
          discoveryLevel: 5,
        },
        actions: {
          savedEventIds: ["event_mainstream"],
          dismissedEventIds: ["event_dismissed"],
          attendedEventIds: ["event_attended"],
        },
      },
    );

    expect(recommendations.map((item) => item.event.id)).toEqual([
      "event_fit",
      "event_mainstream",
    ]);
    expect(recommendations[0].score).toBeGreaterThan(
      recommendations[1].score,
    );
    expect(recommendations[0].reason).toMatch(/acid|techno|small-room/i);
    expect(recommendations[1].reason).toMatch(/saved/i);
  });

  it("uses source confidence and freshness only as ranking tie-breakers", () => {
    const recommendations = rankRecommendedEvents(
      [
        event({
          id: "event_best_fit",
          title: "Small Room Acid Night",
          styles: ["acid", "techno"],
          source: {
            ...source,
            lastVerifiedAt: "2026-01-01",
            confidence: 40,
          },
        }),
        event({
          id: "event_stale_tie",
          title: "Deep House Room",
          source: {
            ...source,
            lastVerifiedAt: "2026-01-01",
            confidence: 60,
          },
        }),
        event({
          id: "event_fresh_tie",
          title: "Deep House Room",
          source: {
            ...source,
            lastVerifiedAt: "2026-05-20",
            confidence: 95,
          },
        }),
      ],
      {
        profile: {
          ...defaultTasteProfile,
          styles: ["acid", "techno"],
          vibe: "raw",
          venueSize: "small-room",
          startTime: "late",
          discoveryLevel: 5,
        },
        actions: {
          savedEventIds: [],
          dismissedEventIds: [],
          attendedEventIds: [],
        },
      },
    );

    expect(recommendations.map((item) => item.event.id)).toEqual([
      "event_best_fit",
      "event_fresh_tie",
      "event_stale_tie",
    ]);
    expect(recommendations[0].score).toBeGreaterThan(
      recommendations[1].score,
    );
    expect(recommendations[1].score).toBe(recommendations[2].score);
  });
});
