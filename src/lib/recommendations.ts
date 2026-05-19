export type TasteStyle =
  | "house"
  | "techno"
  | "acid"
  | "melodic house"
  | "deep house";

export type TasteVibe = "raw" | "deep" | "melodic" | "high-energy";
export type VenueSizePreference = "small-room" | "midsize-club" | "warehouse";
export type StartTimePreference = "early" | "late" | "after-hours";

export type TasteProfile = {
  styles: TasteStyle[];
  vibe: TasteVibe;
  venueSize: VenueSizePreference;
  startTime: StartTimePreference;
  discoveryLevel: number;
};

export type RecommendationActions = {
  savedEventIds: string[];
  dismissedEventIds: string[];
  attendedEventIds: string[];
};

export type RecommendationEvent = {
  id: string;
  title: string;
  startsAt: string;
  venue: {
    name: string;
    neighborhood: string;
    capacity: number | null;
  };
  artists: { name: string; slug?: string }[];
  styles: string[];
  source: {
    title: string;
    url: string;
    lastVerifiedAt: string;
  };
};

export type RecommendationInput = {
  profile: TasteProfile;
  actions: RecommendationActions;
};

export type RecommendedEvent = {
  event: RecommendationEvent;
  score: number;
  reason: string;
  saved: boolean;
};

export const defaultTasteProfile: TasteProfile = {
  styles: ["house", "techno"],
  vibe: "raw",
  venueSize: "small-room",
  startTime: "late",
  discoveryLevel: 4,
};

export const defaultRecommendationActions: RecommendationActions = {
  savedEventIds: [],
  dismissedEventIds: [],
  attendedEventIds: [],
};

const mainstreamNeighborhoods = new Set(["River North", "Wrigleyville"]);

function clampScore(value: number) {
  return Math.min(0.99, Math.max(0.01, Number(value.toFixed(2))));
}

function localChicagoHour(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Chicago",
  }).formatToParts(new Date(startsAt));
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

function startTimeBucket(startsAt: string): StartTimePreference {
  const hour = localChicagoHour(startsAt);
  if (hour >= 0 && hour < 4) {
    return "after-hours";
  }
  if (hour >= 22) {
    return "late";
  }
  return "early";
}

function venueSize(capacity: number | null): VenueSizePreference {
  if (capacity === null) {
    return "midsize-club";
  }
  if (capacity <= 250) {
    return "small-room";
  }
  if (capacity <= 650) {
    return "midsize-club";
  }
  return "warehouse";
}

function eventVibes(event: RecommendationEvent): TasteVibe[] {
  const tokens = [
    event.title,
    event.venue.name,
    event.venue.neighborhood,
    ...event.styles,
    ...event.artists.map((artist) => artist.name),
  ]
    .join(" ")
    .toLowerCase();
  const vibes = new Set<TasteVibe>();

  if (/acid|raw|techno|basement|podlasie|smartbar/.test(tokens)) {
    vibes.add("raw");
  }
  if (/deep|house|warm/.test(tokens)) {
    vibes.add("deep");
  }
  if (/melodic|open-to-close/.test(tokens)) {
    vibes.add("melodic");
  }
  if (/pressure|high|peak|spybar/.test(tokens)) {
    vibes.add("high-energy");
  }

  return [...vibes];
}

function discoveryPotential(event: RecommendationEvent) {
  let score = 0.25;
  if (venueSize(event.venue.capacity) === "small-room") {
    score += 0.35;
  }
  if (!mainstreamNeighborhoods.has(event.venue.neighborhood)) {
    score += 0.25;
  }
  if (
    event.styles.some((style) =>
      ["acid", "deep house", "techno"].includes(style.toLowerCase()),
    )
  ) {
    score += 0.15;
  }
  return Math.min(1, score);
}

function reasonFor(
  event: RecommendationEvent,
  profile: TasteProfile,
  saved: boolean,
) {
  const matchedStyles = event.styles.filter((style) =>
    profile.styles.includes(style.toLowerCase() as TasteStyle),
  );
  if (matchedStyles.length > 0) {
    return `${matchedStyles.join(" / ")} match in a ${venueSize(
      event.venue.capacity,
    )} setting.`;
  }
  if (saved) {
    return "Saved event kept in the queue.";
  }
  if (eventVibes(event).includes(profile.vibe)) {
    return `${profile.vibe} room signal matches your profile.`;
  }
  return `Discovery pick from ${event.venue.neighborhood}.`;
}

export function rankRecommendedEvents(
  events: RecommendationEvent[],
  { profile, actions }: RecommendationInput,
): RecommendedEvent[] {
  const dismissed = new Set(actions.dismissedEventIds);
  const attended = new Set(actions.attendedEventIds);
  const saved = new Set(actions.savedEventIds);

  return events
    .filter((event) => !dismissed.has(event.id) && !attended.has(event.id))
    .map((event) => {
      const matchedStyles = event.styles.filter((style) =>
        profile.styles.includes(style.toLowerCase() as TasteStyle),
      );
      const isSaved = saved.has(event.id);
      let score = 0.42;

      if (matchedStyles.length > 0) {
        score += 0.18 + Math.min(0.08, matchedStyles.length * 0.04);
      }
      if (eventVibes(event).includes(profile.vibe)) {
        score += 0.1;
      }
      if (venueSize(event.venue.capacity) === profile.venueSize) {
        score += 0.1;
      }
      if (startTimeBucket(event.startsAt) === profile.startTime) {
        score += 0.08;
      }
      score += discoveryPotential(event) * (profile.discoveryLevel / 5) * 0.18;
      if (isSaved) {
        score += 0.08;
      }

      return {
        event,
        score: clampScore(score),
        reason: reasonFor(event, profile, isSaved),
        saved: isSaved,
      };
    })
    .toSorted(
      (a, b) =>
        b.score - a.score || a.event.startsAt.localeCompare(b.event.startsAt),
    );
}
