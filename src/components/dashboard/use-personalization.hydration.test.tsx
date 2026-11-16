import { act, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { within } from "@testing-library/react";

import { TasteProfileControls } from "./taste-profile-controls";
import { usePersonalization } from "./use-personalization";

const storageKey = "sound-city.local-profile.v1";

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
} as const;

function TasteProfileHarness() {
  const { profile, setProfile } = usePersonalization();
  return (
    <TasteProfileControls profile={profile} onProfileChange={setProfile} />
  );
}

function renderToStringOnServer(element: ReactElement) {
  const previousWindow = globalThis.window;
  Reflect.deleteProperty(globalThis, "window");
  try {
    if (typeof window !== "undefined") {
      throw new Error("window is still defined during the server render");
    }
    return renderToString(element);
  } finally {
    globalThis.window = previousWindow;
  }
}

function labelFor(container: HTMLElement, name: RegExp) {
  const checkbox = within(container).getByRole("checkbox", { name });
  const label = checkbox.closest("label");
  if (!label) {
    throw new Error(`No label for checkbox ${name}`);
  }
  return label;
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe("taste profile hydration", () => {
  it("matches the server markup on the first client render when a profile is saved", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify(saved));

    const serverHtml = renderToStringOnServer(<TasteProfileHarness />);
    const serverView = document.createElement("div");
    serverView.innerHTML = serverHtml;
    document.body.appendChild(serverView);

    expect(labelFor(serverView, /^house$/i)).toHaveClass(
      "bg-panel",
      "text-signal",
    );
    expect(labelFor(serverView, /^techno$/i)).toHaveClass(
      "bg-panel",
      "text-signal",
    );
    expect(labelFor(serverView, /^acid$/i)).toHaveClass("text-ink-dim");
    expect(
      within(serverView).getByRole("checkbox", { name: /^acid$/i }),
    ).not.toBeChecked();
    serverView.remove();

    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = serverHtml;

    const reported: string[] = [];
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        reported.push(args.map((arg) => String(arg)).join(" "));
      });

    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <TasteProfileHarness />, {
          onRecoverableError(error) {
            reported.push(error instanceof Error ? error.message : String(error));
          },
        });
      });

      const mismatches = reported.filter((message) =>
        /hydrat|didn't match|did not match|server rendered/i.test(message),
      );
      expect(mismatches).toEqual([]);

      expect(
        within(container).getByRole("checkbox", { name: /^acid$/i }),
      ).toBeChecked();
      expect(
        within(container).getByRole("checkbox", { name: /^house$/i }),
      ).not.toBeChecked();
      expect(labelFor(container, /^acid$/i)).toHaveClass(
        "bg-panel",
        "text-signal",
      );

      expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
        saved,
      );
    } finally {
      consoleError.mockRestore();
      root?.unmount();
      container.remove();
    }
  });
});
