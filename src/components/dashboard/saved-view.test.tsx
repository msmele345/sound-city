import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SavedPage from "@/app/(public)/saved/page";
import { navigationStub } from "@/test/navigation-stub";

import { PublicShell } from "./public-shell";

const storageKey = "sound-city.local-profile.v1";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
  navigationStub.pathname = "/saved";
});

describe("Saved route", () => {
  it("lists saved events from snapshots after they leave the catalog and groups past events", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: ["event_future", "event_past"],
          dismissedEventIds: [],
          attendedEventIds: [],
          savedSnapshots: [
            {
              id: "event_past",
              title: "Old Night",
              startsAt: "2020-01-01T03:00:00.000Z",
              venueName: "Spybar",
              neighborhood: "River West",
              sourceUrl: "https://example.com/old",
            },
            {
              id: "event_future",
              title: "Lemtom",
              startsAt: "2030-05-24T03:00:00.000Z",
              venueName: "smartbar",
              neighborhood: "Wrigleyville",
              sourceUrl: "https://example.com/lemtom",
            },
          ],
        },
      }),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    });

    render(
      <PublicShell>
        <SavedPage />
      </PublicShell>,
    );

    const saved = await screen.findByRole("region", { name: /^saved$/i });
    const upcoming = within(saved).getByRole("heading", { name: /^lemtom$/i });
    const pastHeading = within(saved).getByRole("heading", { name: /^past$/i });
    const pastEvent = within(saved).getByRole("heading", { name: /old night/i });
    expect(
      upcoming.compareDocumentPosition(pastHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      pastHeading.compareDocumentPosition(pastEvent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(saved).getByText(/smartbar/i)).toBeInTheDocument();
    expect(within(saved).getByText(/wrigleyville/i)).toBeInTheDocument();
    expect(within(saved).getByRole("link", { name: /^lemtom$/i })).toHaveAttribute(
      "href",
      "https://example.com/lemtom",
    );
    expect(within(saved).getByRole("link", { name: /^lemtom$/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(within(saved).getByRole("link", { name: /old night/i })).toHaveAttribute(
      "href",
      "https://example.com/old",
    );

    const upcomingRow = upcoming.closest("li");
    expect(upcomingRow).not.toBeNull();
    await user.click(within(upcomingRow!).getByRole("button", { name: /^saved$/i }));
    expect(
      within(saved).queryByRole("heading", { name: /^lemtom$/i }),
    ).not.toBeInTheDocument();
    expect(within(saved).getByRole("heading", { name: /old night/i })).toBeInTheDocument();
  });
});
