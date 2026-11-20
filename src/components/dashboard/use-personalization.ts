"use client";

import { useEffect, useState } from "react";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
  type EventSnapshot,
  type RecommendationActions,
  type StartTimePreference,
  type TasteProfile,
  type TasteStyle,
  type TasteVibe,
  type VenueSizePreference,
} from "@/lib/recommendations";
import { canonicalTechnoSubGenres } from "@/lib/style-normalization";

const storageKey = "sound-city.local-profile.v1";

export const styleOptions: TasteStyle[] = [
  "house",
  "techno",
  "acid",
  "melodic house",
  "deep house",
  ...canonicalTechnoSubGenres,
];

type LocalPersonalization = {
  profile: TasteProfile;
  actions: RecommendationActions;
};

export type PersonalizationEvent = {
  id: string;
  title: string;
  startsAt: string;
  venue: { name: string; neighborhood: string };
  source: { url: string };
};

function isTasteStyle(value: string): value is TasteStyle {
  return styleOptions.includes(value as TasteStyle);
}

const vibeValues = ["raw", "deep", "melodic", "high-energy"] as const;
const venueSizeValues = ["small-room", "midsize-club", "warehouse"] as const;
const startTimeValues = ["early", "late", "after-hours"] as const;

function knownChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function readLocalPersonalization(): LocalPersonalization {
  if (typeof window === "undefined") {
    return {
      profile: defaultTasteProfile,
      actions: defaultRecommendationActions,
    };
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return {
        profile: defaultTasteProfile,
        actions: defaultRecommendationActions,
      };
    }

    const parsed = JSON.parse(stored) as Partial<LocalPersonalization>;
    const storedStyles = parsed.profile?.styles?.filter(
      (style): style is TasteStyle => isTasteStyle(style),
    );
    return {
      profile: {
        ...defaultTasteProfile,
        ...parsed.profile,
        styles:
          storedStyles && storedStyles.length > 0
            ? storedStyles
            : defaultTasteProfile.styles,
        vibe: knownChoice<TasteVibe>(
          parsed.profile?.vibe,
          vibeValues,
          defaultTasteProfile.vibe,
        ),
        venueSize: knownChoice<VenueSizePreference>(
          parsed.profile?.venueSize,
          venueSizeValues,
          defaultTasteProfile.venueSize,
        ),
        startTime: knownChoice<StartTimePreference>(
          parsed.profile?.startTime,
          startTimeValues,
          defaultTasteProfile.startTime,
        ),
        discoveryLevel: Number(parsed.profile?.discoveryLevel ?? 4),
      },
      actions: readActions(parsed.actions),
    };
  } catch {
    return {
      profile: defaultTasteProfile,
      actions: defaultRecommendationActions,
    };
  }
}

export function usePersonalization() {
  const [personalization, setPersonalization] = useState<LocalPersonalization>({
    profile: defaultTasteProfile,
    actions: defaultRecommendationActions,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // The first render stays on the defaults so server HTML and the client
    // hydrate match. The stored profile is applied after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store read after hydration
    setPersonalization(readLocalPersonalization());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(personalization));
  }, [hydrated, personalization]);

  function setProfile(profile: TasteProfile) {
    setPersonalization((current) => ({ ...current, profile }));
  }

  function setActions(actions: RecommendationActions) {
    setPersonalization((current) => ({ ...current, actions }));
  }

  function updateActions(
    recipe: (actions: RecommendationActions) => RecommendationActions,
  ) {
    setPersonalization((current) => ({
      ...current,
      actions: recipe(current.actions),
    }));
  }

  function toggleSaved(event: PersonalizationEvent) {
    const snapshot = snapshotFromEvent(event);
    updateActions((actions) => {
      const saved = actions.savedEventIds.includes(event.id);
      return compactActions({
        ...actions,
        savedEventIds: saved
          ? removeId(actions.savedEventIds, event.id)
          : addId(actions.savedEventIds, event.id),
        savedSnapshots: saved
          ? withoutSnapshot(actions.savedSnapshots, event.id)
          : withSnapshot(actions.savedSnapshots, snapshot),
      });
    });
  }

  function dismiss(id: string) {
    updateActions((actions) =>
      compactActions({
        ...actions,
        savedEventIds: removeId(actions.savedEventIds, id),
        savedSnapshots: withoutSnapshot(actions.savedSnapshots, id),
        dismissedEventIds: addId(actions.dismissedEventIds, id),
      }),
    );
  }

  function restore(id: string) {
    updateActions((actions) =>
      compactActions({
        ...actions,
        dismissedEventIds: removeId(actions.dismissedEventIds, id),
      }),
    );
  }

  function attend(event: PersonalizationEvent) {
    const snapshot = snapshotFromEvent(event);
    updateActions((actions) =>
      compactActions({
        ...actions,
        savedEventIds: removeId(actions.savedEventIds, event.id),
        savedSnapshots: withoutSnapshot(actions.savedSnapshots, event.id),
        attendedEventIds: addId(actions.attendedEventIds, event.id),
        attendedSnapshots: withSnapshot(actions.attendedSnapshots, snapshot),
      }),
    );
  }

  function resetProfile() {
    setPersonalization((current) => ({
      ...current,
      profile: defaultTasteProfile,
    }));
  }

  return {
    profile: personalization.profile,
    actions: personalization.actions,
    setProfile,
    setActions,
    toggleSaved,
    dismiss,
    restore,
    attend,
    resetProfile,
  };
}

function addId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removeId(ids: string[], id: string) {
  return ids.filter((current) => current !== id);
}

function snapshotFromEvent(event: PersonalizationEvent): EventSnapshot {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    venueName: event.venue.name,
    neighborhood: event.venue.neighborhood,
    sourceUrl: event.source.url,
  };
}

function withSnapshot(snapshots: EventSnapshot[] | undefined, snapshot: EventSnapshot) {
  return [...(snapshots ?? []).filter((item) => item.id !== snapshot.id), snapshot];
}

function withoutSnapshot(snapshots: EventSnapshot[] | undefined, id: string) {
  return (snapshots ?? []).filter((item) => item.id !== id);
}

function compactActions(actions: RecommendationActions): RecommendationActions {
  const next: RecommendationActions = {
    savedEventIds: actions.savedEventIds,
    dismissedEventIds: actions.dismissedEventIds,
    attendedEventIds: actions.attendedEventIds,
  };
  if (actions.savedSnapshots?.length) {
    next.savedSnapshots = actions.savedSnapshots;
  }
  if (actions.attendedSnapshots?.length) {
    next.attendedSnapshots = actions.attendedSnapshots;
  }
  return next;
}

function stringIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

function readSnapshots(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const snapshots = value.filter(isEventSnapshot);
  return snapshots.length > 0 ? snapshots : undefined;
}

function isEventSnapshot(value: unknown): value is EventSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as EventSnapshot;
  return (
    typeof snapshot.id === "string" &&
    typeof snapshot.title === "string" &&
    typeof snapshot.startsAt === "string" &&
    typeof snapshot.venueName === "string" &&
    typeof snapshot.neighborhood === "string" &&
    typeof snapshot.sourceUrl === "string"
  );
}

function readActions(actions: Partial<RecommendationActions> | undefined) {
  return compactActions({
    ...defaultRecommendationActions,
    ...actions,
    savedEventIds: stringIds(actions?.savedEventIds),
    dismissedEventIds: stringIds(actions?.dismissedEventIds),
    attendedEventIds: stringIds(actions?.attendedEventIds),
    savedSnapshots: readSnapshots(actions?.savedSnapshots),
    attendedSnapshots: readSnapshots(actions?.attendedSnapshots),
  });
}
