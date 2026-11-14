import { renderHook } from "@testing-library/react";

import { usePersonalization } from "./use-personalization";

const storageKey = "sound-city.local-profile.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("usePersonalization", () => {
  it("returns the default profile and actions when nothing is stored", () => {
    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile).toEqual({
      styles: ["house", "techno"],
      vibe: "raw",
      venueSize: "small-room",
      startTime: "late",
      discoveryLevel: 4,
    });
    expect(result.current.actions).toEqual({
      savedEventIds: [],
      dismissedEventIds: [],
      attendedEventIds: [],
    });
  });

  it("returns defaults when the stored JSON is corrupt", () => {
    window.localStorage.setItem(storageKey, "{");

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile).toEqual({
      styles: ["house", "techno"],
      vibe: "raw",
      venueSize: "small-room",
      startTime: "late",
      discoveryLevel: 4,
    });
    expect(result.current.actions).toEqual({
      savedEventIds: [],
      dismissedEventIds: [],
      attendedEventIds: [],
    });
  });

  it("filters unknown styles out of a stored profile", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        profile: { styles: ["house", "not-a-style", "techno"] },
      }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile.styles).toEqual(["house", "techno"]);
  });

  it("merges partial stored data with defaults", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        profile: { vibe: "deep" },
        actions: { savedEventIds: ["event_1"] },
      }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile).toEqual({
      styles: ["house", "techno"],
      vibe: "deep",
      venueSize: "small-room",
      startTime: "late",
      discoveryLevel: 4,
    });
    expect(result.current.actions).toEqual({
      savedEventIds: ["event_1"],
      dismissedEventIds: [],
      attendedEventIds: [],
    });
  });
});
