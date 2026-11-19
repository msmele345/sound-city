import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
  type TasteProfile,
} from "@/lib/recommendations";

import { RecommendedEvents } from "./recommended-events";
import type { CatalogEvent } from "./types";
import { usePersonalization } from "./use-personalization";

const event: CatalogEvent = {
  id: "event_acid_room",
  title: "Acid Room",
  startsAt: "2026-05-23T03:00:00.000Z",
  venue: {
    name: "Podlasie Club",
    neighborhood: "Avondale",
    capacity: 220,
  },
  artists: [{ name: "Local Acid Selector" }],
  styles: ["acid", "techno"],
  source: {
    title: "Acid listing",
    url: "https://example.com/acid",
    lastVerifiedAt: "2026-05-15",
  },
};

function renderQueue(profile: TasteProfile = defaultTasteProfile) {
  function Harness() {
    const [current, setCurrent] = useState(profile);
    return (
      <RecommendedEvents
        feed={{ status: "ready", events: [event] }}
        profile={current}
        actions={defaultRecommendationActions}
        onProfileChange={setCurrent}
        onActionsChange={() => undefined}
      />
    );
  }

  return render(<Harness />);
}

function StoredQueue() {
  const { profile, actions, setProfile, setActions } = usePersonalization();
  return (
    <RecommendedEvents
      feed={{ status: "ready", events: [event] }}
      profile={profile}
      actions={actions}
      onProfileChange={setProfile}
      onActionsChange={setActions}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("taste profile panel", () => {
  it("summarizes styles, vibe, venue size, start time, and discovery level above the recommendations", async () => {
    const user = userEvent.setup();
    renderQueue();

    const summary = screen.getByText(
      "house, techno · Raw · Small room · Late · Discovery 4",
    );
    const recommendation = screen.getByRole("heading", { name: /acid room/i });
    expect(
      summary.compareDocumentPosition(recommendation) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^tune$/i }));
    await user.click(screen.getByRole("checkbox", { name: /^acid$/i }));

    expect(
      screen.getByText(
        "house, techno, acid · Raw · Small room · Late · Discovery 4",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the taste controls behind Tune until it is opened", async () => {
    const user = userEvent.setup();
    renderQueue();

    const tune = screen.getByRole("button", { name: /^tune$/i });
    expect(tune).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("checkbox", { name: /^house$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /acid room/i }),
    ).toBeInTheDocument();

    await user.click(tune);

    expect(tune).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: /^house$/i })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /^acid$/i }),
    ).not.toBeChecked();
  });

  it("chooses a vibe from a segmented control", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: /^tune$/i }));

    expect(
      screen.queryByRole("combobox", { name: /vibe/i }),
    ).not.toBeInTheDocument();
    const vibe = screen.getByRole("radiogroup", { name: /vibe/i });
    expect(within(vibe).getByRole("radio", { name: /^raw$/i })).toBeChecked();

    await user.click(within(vibe).getByRole("radio", { name: /^deep$/i }));

    expect(within(vibe).getByRole("radio", { name: /^deep$/i })).toBeChecked();
    expect(within(vibe).getByRole("radio", { name: /^raw$/i })).not.toBeChecked();
    expect(
      screen.getByText("house, techno · Deep · Small room · Late · Discovery 4"),
    ).toBeInTheDocument();
  });

  it("chooses a venue size from a segmented control", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: /^tune$/i }));

    expect(
      screen.queryByRole("combobox", { name: /venue size/i }),
    ).not.toBeInTheDocument();
    const venueSize = screen.getByRole("radiogroup", { name: /venue size/i });
    expect(
      within(venueSize).getByRole("radio", { name: /small room/i }),
    ).toBeChecked();

    await user.click(within(venueSize).getByRole("radio", { name: /warehouse/i }));

    expect(
      within(venueSize).getByRole("radio", { name: /warehouse/i }),
    ).toBeChecked();
    expect(
      screen.getByText(
        "house, techno · Raw · Warehouse · Late · Discovery 4",
      ),
    ).toBeInTheDocument();
  });

  it("chooses a start time from a segmented control", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: /^tune$/i }));

    expect(
      screen.queryByRole("combobox", { name: /start time/i }),
    ).not.toBeInTheDocument();
    const startTime = screen.getByRole("radiogroup", { name: /start time/i });
    expect(within(startTime).getByRole("radio", { name: /^late$/i })).toBeChecked();

    await user.click(
      within(startTime).getByRole("radio", { name: /after hours/i }),
    );

    expect(
      within(startTime).getByRole("radio", { name: /after hours/i }),
    ).toBeChecked();
    expect(
      screen.getByText(
        "house, techno · Raw · Small room · After hours · Discovery 4",
      ),
    ).toBeInTheDocument();
  });

  it("labels the discovery slider from mainstream to underground", async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole("button", { name: /^tune$/i }));

    const slider = screen.getByRole("slider", { name: /discovery level/i });
    expect(screen.getByText("Mainstream")).toBeInTheDocument();
    expect(screen.getByText("Underground")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "4 of 5, between Mainstream and Underground",
    );

    fireEvent.change(slider, { target: { value: "5" } });

    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "5 of 5, Underground",
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(
      screen.getByText(
        "house, techno · Raw · Small room · Late · Discovery 5",
      ),
    ).toBeInTheDocument();
  });

  it("resets the taste profile to the defaults", async () => {
    const user = userEvent.setup();
    render(<StoredQueue />);
    await user.click(screen.getByRole("button", { name: /^tune$/i }));
    await user.click(screen.getByRole("radio", { name: /^deep$/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));

    expect(
      screen.getByText("house, techno · Raw · Small room · Late · Discovery 4"),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^raw$/i })).toBeChecked();
    expect(screen.getByRole("button", { name: /^saved$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(JSON.parse(window.localStorage.getItem("sound-city.local-profile.v1") ?? "{}")).toMatchObject({
      profile: defaultTasteProfile,
      actions: { savedEventIds: ["event_acid_room"] },
    });
  });
});
