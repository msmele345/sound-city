import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
  type TasteProfile,
} from "@/lib/recommendations";

import { RecommendedEvents } from "./recommended-events";
import type { CatalogEvent } from "./types";

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
});
