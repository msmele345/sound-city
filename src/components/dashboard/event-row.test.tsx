import { render, screen } from "@testing-library/react";

import { EventRow } from "./event-row";
import type { CatalogEvent } from "./types";

const event: CatalogEvent = {
  id: "event_lemtom",
  title: "Lemtom",
  startsAt: "2026-05-24T03:00:00.000Z",
  venue: {
    name: "Spybar",
    neighborhood: "River West",
    capacity: 200,
  },
  artists: [{ name: "Lemtom" }],
  styles: ["house"],
  source: {
    title: "Resident Advisor listing",
    url: "https://example.com/lemtom",
    lastVerifiedAt: "2026-05-15",
  },
};

function renderRow(variant: "recommendation" | "feed" | "compact", compact?: "venue" | "artist") {
  return render(
    <ol>
      <EventRow
        event={event}
        variant={variant}
        compact={compact}
        reason="House match."
        score={0.8}
      />
    </ol>,
  );
}

function expectSourceTitleLink() {
  const title = screen.getByRole("link", { name: /^lemtom$/i });
  expect(title).toHaveAttribute("href", "https://example.com/lemtom");
  expect(title).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("heading", { name: /^lemtom$/i })).toBeInTheDocument();
}

describe("event row", () => {
  it("shows the match score as a percentage and keeps the spoken text", () => {
    renderRow("recommendation");
    expect(screen.getByText("80% match")).toBeInTheDocument();
    expect(screen.getByText("Match 80 percent")).toBeInTheDocument();
    expect(screen.queryByText("0.80")).not.toBeInTheDocument();
  });

  it("links a recommendation title to the source page in a new tab", () => {
    renderRow("recommendation");
    expectSourceTitleLink();
  });

  it("links a feed title to the source page in a new tab", () => {
    renderRow("feed");
    expectSourceTitleLink();
  });

  it("links a compact venue title to the source page in a new tab", () => {
    renderRow("compact", "venue");
    expectSourceTitleLink();
  });

  it("links a compact artist title to the source page in a new tab", () => {
    renderRow("compact", "artist");
    expectSourceTitleLink();
  });
});
