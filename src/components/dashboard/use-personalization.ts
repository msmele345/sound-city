"use client";

import { useEffect, useState } from "react";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
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
      actions: {
        ...defaultRecommendationActions,
        ...parsed.actions,
      },
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

  function toggleSaved(id: string) {
    updateActions((actions) => ({
      ...actions,
      savedEventIds: actions.savedEventIds.includes(id)
        ? removeId(actions.savedEventIds, id)
        : addId(actions.savedEventIds, id),
    }));
  }

  function dismiss(id: string) {
    updateActions((actions) => ({
      ...actions,
      savedEventIds: removeId(actions.savedEventIds, id),
      dismissedEventIds: addId(actions.dismissedEventIds, id),
    }));
  }

  function restore(id: string) {
    updateActions((actions) => ({
      ...actions,
      dismissedEventIds: removeId(actions.dismissedEventIds, id),
    }));
  }

  function attend(id: string) {
    updateActions((actions) => ({
      ...actions,
      savedEventIds: removeId(actions.savedEventIds, id),
      attendedEventIds: addId(actions.attendedEventIds, id),
    }));
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
