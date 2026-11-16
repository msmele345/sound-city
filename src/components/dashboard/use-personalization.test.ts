import { StrictMode, createElement, type ReactNode } from "react";
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

  it("applies a saved profile after mount without replacing it with the defaults", () => {
    const saved = {
      profile: {
        styles: ["acid"],
        vibe: "deep",
        venueSize: "warehouse",
        startTime: "after-hours",
        discoveryLevel: 2,
      },
      actions: {
        savedEventIds: ["event_saved"],
        dismissedEventIds: ["event_dismissed"],
        attendedEventIds: ["event_attended"],
      },
    };
    window.localStorage.setItem(storageKey, JSON.stringify(saved));

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile).toEqual(saved.profile);
    expect(result.current.actions).toEqual(saved.actions);
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      saved,
    );
  });

  it("applies a saved profile after mount in Strict Mode", () => {
    const saved = {
      profile: {
        styles: ["acid"],
        vibe: "deep",
        venueSize: "warehouse",
        startTime: "after-hours",
        discoveryLevel: 2,
      },
      actions: {
        savedEventIds: ["event_saved"],
        dismissedEventIds: ["event_dismissed"],
        attendedEventIds: ["event_attended"],
      },
    };
    window.localStorage.setItem(storageKey, JSON.stringify(saved));

    const { result } = renderHook(() => usePersonalization(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(StrictMode, null, children),
    });

    expect(result.current.profile).toEqual(saved.profile);
    expect(result.current.actions).toEqual(saved.actions);
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      saved,
    );
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
