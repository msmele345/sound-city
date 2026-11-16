"use client";

import { useEffect, useState } from "react";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
  type RecommendationActions,
  type TasteProfile,
  type TasteStyle,
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
    return {
      profile: {
        ...defaultTasteProfile,
        ...parsed.profile,
        styles:
          parsed.profile?.styles?.filter((style): style is TasteStyle =>
            isTasteStyle(style),
          ) ?? defaultTasteProfile.styles,
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

  return {
    profile: personalization.profile,
    actions: personalization.actions,
    setProfile,
    setActions,
  };
}
