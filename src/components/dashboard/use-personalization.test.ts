import { StrictMode, createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";

import { usePersonalization } from "./use-personalization";

const storageKey = "sound-city.local-profile.v1";

function storedEvent(id: string) {
  return {
    id,
    title: id,
    startsAt: "2026-05-23T03:00:00.000Z",
    venue: { name: "Room", neighborhood: "West Loop" },
    source: { url: `https://example.com/${id}` },
  };
}

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

  it("falls back to the default styles when the saved list is empty", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ profile: { styles: [] } }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile.styles).toEqual(["house", "techno"]);
  });

  it("falls back to the default styles when every saved style is invalid", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ profile: { styles: ["not-a-style", "also-not"] } }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile.styles).toEqual(["house", "techno"]);
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

  it("falls back to the default vibe, venue size, and start time when a saved value is unknown", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        profile: {
          vibe: "nope",
          venueSize: "ballroom",
          startTime: "noon",
        },
      }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.profile.vibe).toBe("raw");
    expect(result.current.profile.venueSize).toBe("small-room");
    expect(result.current.profile.startTime).toBe("late");
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

  it("toggles an event in and out of saved", () => {
    const { result } = renderHook(() => usePersonalization());

    act(() => result.current.toggleSaved(storedEvent("event_1")));

    expect(result.current.actions.savedEventIds).toEqual(["event_1"]);

    act(() => result.current.toggleSaved(storedEvent("event_1")));

    expect(result.current.actions.savedEventIds).toEqual([]);
  });

  it("dismisses an event and clears it from saved", () => {
    const { result } = renderHook(() => usePersonalization());

    act(() => result.current.toggleSaved(storedEvent("event_1")));
    act(() => result.current.dismiss("event_1"));

    expect(result.current.actions.dismissedEventIds).toEqual(["event_1"]);
    expect(result.current.actions.savedEventIds).toEqual([]);
  });

  it("restores a dismissed event", () => {
    const { result } = renderHook(() => usePersonalization());

    act(() => result.current.dismiss("event_1"));
    act(() => result.current.restore("event_1"));

    expect(result.current.actions.dismissedEventIds).toEqual([]);
  });

  it("marks an event attended and clears it from saved", () => {
    const { result } = renderHook(() => usePersonalization());

    act(() => result.current.toggleSaved(storedEvent("event_1")));
    act(() => result.current.attend(storedEvent("event_1")));

    expect(result.current.actions.attendedEventIds).toEqual(["event_1"]);
    expect(result.current.actions.savedEventIds).toEqual([]);
  });

  it("stores a snapshot when an event is saved or marked attended", () => {
    const { result } = renderHook(() => usePersonalization());
    const event = {
      id: "event_lemtom",
      title: "Lemtom",
      startsAt: "2026-05-24T03:00:00.000Z",
      venue: { name: "Spybar", neighborhood: "River West" },
      source: { url: "https://example.com/lemtom" },
    };
    const snapshot = {
      id: "event_lemtom",
      title: "Lemtom",
      startsAt: "2026-05-24T03:00:00.000Z",
      venueName: "Spybar",
      neighborhood: "River West",
      sourceUrl: "https://example.com/lemtom",
    };

    act(() => result.current.toggleSaved(event));

    expect(result.current.actions.savedEventIds).toEqual(["event_lemtom"]);
    expect(result.current.actions.savedSnapshots).toEqual([snapshot]);
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").actions).toMatchObject({
      savedEventIds: ["event_lemtom"],
      savedSnapshots: [snapshot],
    });

    act(() => result.current.attend(event));

    expect(result.current.actions.savedEventIds).toEqual([]);
    expect(result.current.actions.savedSnapshots).toBeUndefined();
    expect(result.current.actions.attendedEventIds).toEqual(["event_lemtom"]);
    expect(result.current.actions.attendedSnapshots).toEqual([snapshot]);
  });

  it("refreshes saved and attended snapshots from the loaded catalog", () => {
    const stale = {
      id: "event_lemtom",
      title: "Old title",
      startsAt: "2026-05-24T03:00:00.000Z",
      venueName: "Old room",
      neighborhood: "Old neighborhood",
      sourceUrl: "https://example.com/old",
    };
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: ["event_lemtom", "event_kept"],
          dismissedEventIds: [],
          attendedEventIds: ["event_attended"],
          savedSnapshots: [
            stale,
            {
              id: "event_kept",
              title: "Kept Night",
              startsAt: "2026-01-01T03:00:00.000Z",
              venueName: "Podlasie",
              neighborhood: "Avondale",
              sourceUrl: "https://example.com/kept",
            },
          ],
          attendedSnapshots: [{ ...stale, id: "event_attended", title: "Old attended" }],
        },
      }),
    );
    const catalog = [
      {
        id: "event_lemtom",
        title: "Lemtom",
        startsAt: "2026-05-24T04:00:00.000Z",
        venue: { name: "Spybar", neighborhood: "River West" },
        source: { url: "https://example.com/lemtom" },
      },
      {
        id: "event_attended",
        title: "Attended Night",
        startsAt: "2026-05-25T04:00:00.000Z",
        venue: { name: "smartbar", neighborhood: "Wrigleyville" },
        source: { url: "https://example.com/attended" },
      },
    ];

    const { result } = renderHook(() => usePersonalization(catalog));

    expect(result.current.actions.savedEventIds).toEqual([
      "event_lemtom",
      "event_kept",
    ]);
    expect(result.current.actions.savedSnapshots).toEqual([
      {
        id: "event_lemtom",
        title: "Lemtom",
        startsAt: "2026-05-24T04:00:00.000Z",
        venueName: "Spybar",
        neighborhood: "River West",
        sourceUrl: "https://example.com/lemtom",
      },
      {
        id: "event_kept",
        title: "Kept Night",
        startsAt: "2026-01-01T03:00:00.000Z",
        venueName: "Podlasie",
        neighborhood: "Avondale",
        sourceUrl: "https://example.com/kept",
      },
    ]);
    expect(result.current.actions.attendedSnapshots).toEqual([
      {
        id: "event_attended",
        title: "Attended Night",
        startsAt: "2026-05-25T04:00:00.000Z",
        venueName: "smartbar",
        neighborhood: "Wrigleyville",
        sourceUrl: "https://example.com/attended",
      },
    ]);
  });

  it("fills in a snapshot for an id-only save when the catalog has that event", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: ["event_lemtom"],
          dismissedEventIds: [],
          attendedEventIds: [],
        },
      }),
    );

    const { result } = renderHook(() =>
      usePersonalization([
        {
          id: "event_lemtom",
          title: "Lemtom",
          startsAt: "2026-05-24T04:00:00.000Z",
          venue: { name: "Spybar", neighborhood: "River West" },
          source: { url: "https://example.com/lemtom" },
        },
      ]),
    );

    expect(result.current.actions.savedEventIds).toEqual(["event_lemtom"]);
    expect(result.current.actions.savedSnapshots).toEqual([
      {
        id: "event_lemtom",
        title: "Lemtom",
        startsAt: "2026-05-24T04:00:00.000Z",
        venueName: "Spybar",
        neighborhood: "River West",
        sourceUrl: "https://example.com/lemtom",
      },
    ]);
  });

  it("loads stored actions that hold only ids", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: ["event_saved"],
          dismissedEventIds: ["event_dismissed"],
          attendedEventIds: ["event_attended"],
        },
      }),
    );

    const { result } = renderHook(() => usePersonalization());

    expect(result.current.actions).toEqual({
      savedEventIds: ["event_saved"],
      dismissedEventIds: ["event_dismissed"],
      attendedEventIds: ["event_attended"],
    });
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").actions,
    ).toEqual({
      savedEventIds: ["event_saved"],
      dismissedEventIds: ["event_dismissed"],
      attendedEventIds: ["event_attended"],
    });
  });

  it("resets the profile to the defaults and keeps actions", () => {
    const { result } = renderHook(() => usePersonalization());

    act(() =>
      result.current.setProfile({
        styles: ["acid"],
        vibe: "deep",
        venueSize: "warehouse",
        startTime: "after-hours",
        discoveryLevel: 1,
      }),
    );
    act(() => result.current.toggleSaved(storedEvent("event_1")));
    act(() => result.current.resetProfile());

    expect(result.current.profile).toEqual({
      styles: ["house", "techno"],
      vibe: "raw",
      venueSize: "small-room",
      startTime: "late",
      discoveryLevel: 4,
    });
    expect(result.current.actions.savedEventIds).toEqual(["event_1"]);
  });
});
