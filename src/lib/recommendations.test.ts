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
    expect(recommendations[0].reason).toBe(
      "Acid and techno match in a small room.",
    );
    expect(recommendations[1].reason).toBe("This saved event stays in the queue.");
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
    expect(recommendations[1].reason).toBe("The raw room matches your profile.");
    expect(recommendations[2].reason).toBe("The raw room matches your profile.");
  });

  it("writes reasons as sentences with readable labels", () => {
    const [highEnergy] = rankRecommendedEvents(
      [
        event({
          id: "event_peak",
          title: "Peak Pressure",
          styles: ["disco"],
          venue: {
            name: "Spybar",
            neighborhood: "River North",
            capacity: 400,
          },
        }),
      ],
      {
        profile: {
          ...defaultTasteProfile,
          styles: ["house"],
          vibe: "high-energy",
          venueSize: "midsize-club",
        },
        actions: {
          savedEventIds: [],
          dismissedEventIds: [],
          attendedEventIds: [],
        },
      },
    );
    const [discovery] = rankRecommendedEvents(
      [
        event({
          id: "event_elsewhere",
          title: "Quiet Billing",
          styles: ["disco"],
          venue: {
            name: "Hall",
            neighborhood: "Pilsen",
            capacity: 900,
          },
        }),
      ],
      {
        profile: {
          ...defaultTasteProfile,
          styles: ["house"],
          vibe: "melodic",
          venueSize: "warehouse",
        },
        actions: {
          savedEventIds: [],
          dismissedEventIds: [],
          attendedEventIds: [],
        },
      },
    );

    expect(highEnergy?.reason).toBe("The high energy room matches your profile.");
    expect(discovery?.reason).toBe("A discovery pick from Pilsen.");
  });

  it("reads saved, dismissed, and attended from ids, not snapshots", () => {
    const saved = event({ id: "event_saved_id" });
    const snapshotOnly = event({ id: "event_snapshot_only" });
    const dismissed = event({ id: "event_dismissed_id" });

    const recommendations = rankRecommendedEvents([saved, snapshotOnly, dismissed], {
      profile: defaultTasteProfile,
      actions: {
        savedEventIds: ["event_saved_id"],
        dismissedEventIds: ["event_dismissed_id"],
        attendedEventIds: [],
        savedSnapshots: [
          {
            id: "event_snapshot_only",
            title: "Snapshot Only",
            startsAt: snapshotOnly.startsAt,
            venueName: "Room",
            neighborhood: "West Loop",
            sourceUrl: "https://example.com/snapshot",
          },
        ],
      },
    });

    expect(recommendations.map((item) => item.event.id)).toEqual([
      "event_saved_id",
      "event_snapshot_only",
    ]);
    expect(recommendations.find((item) => item.event.id === "event_saved_id")?.saved).toBe(
      true,
    );
    expect(
      recommendations.find((item) => item.event.id === "event_snapshot_only")?.saved,
    ).toBe(false);
  });
});
