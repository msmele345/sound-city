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
  it("shows Saved in the nav with a live count", async () => {
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

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    const savedLink = within(nav).getByRole("link", { name: /saved/i });
    expect(savedLink).toHaveAttribute("href", "/saved");
    expect(savedLink).toHaveAttribute("aria-current", "page");
    expect(savedLink).toHaveTextContent("02");

    const row = (
      await screen.findByRole("heading", { name: /^lemtom$/i })
    ).closest("li");
    await user.click(within(row!).getByRole("button", { name: /^saved$/i }));

    expect(savedLink).toHaveTextContent("01");
  });

  it("shows an id-only save that is not in the feed and removes it", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: ["event_may_2026"],
          dismissedEventIds: [],
          attendedEventIds: [],
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

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    const savedLink = within(nav).getByRole("link", { name: /saved/i });
    expect(savedLink).toHaveTextContent("01");

    const saved = await screen.findByRole("region", { name: /^saved$/i });
    expect(
      await within(saved).findByRole("heading", { name: /event details unavailable/i }),
    ).toBeInTheDocument();
    expect(within(saved).queryByText(/nothing saved yet/i)).not.toBeInTheDocument();

    await user.click(within(saved).getByRole("button", { name: /^remove$/i }));

    expect(savedLink).toHaveTextContent("00");
    expect(
      within(saved).queryByRole("heading", { name: /event details unavailable/i }),
    ).not.toBeInTheDocument();
    expect(within(saved).getByText(/nothing saved yet/i)).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").actions.savedEventIds,
    ).not.toContain("event_may_2026");
  });

  it("points each empty list back to For You", async () => {
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
    expect(within(saved).getByText(/nothing saved yet/i)).toBeInTheDocument();
    expect(within(saved).getByText(/nothing marked attended/i)).toBeInTheDocument();
    expect(within(saved).getByText(/nothing dismissed/i)).toBeInTheDocument();
    const links = within(saved).getAllByRole("link", { name: /^for you$/i });
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/");
    }
  });

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

  it("lists attended events from snapshots and upcoming dismissed events from the catalog", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        actions: {
          savedEventIds: [],
          dismissedEventIds: ["event_dismissed", "event_gone", "event_past_dismissed"],
          attendedEventIds: ["event_attended"],
          attendedSnapshots: [
            {
              id: "event_attended",
              title: "Attended Night",
              startsAt: "2020-06-01T03:00:00.000Z",
              venueName: "Spybar",
              neighborhood: "River West",
              sourceUrl: "https://example.com/attended",
            },
          ],
        },
      }),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "event_dismissed",
            title: "Dismissed Night",
            startsAt: "2030-05-24T03:00:00.000Z",
            venue: { name: "smartbar", neighborhood: "Wrigleyville", capacity: 400 },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Listing",
              url: "https://example.com/dismissed",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_past_dismissed",
            title: "Already Over",
            startsAt: "2020-01-01T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West", capacity: 200 },
            artists: [],
            styles: ["techno"],
            source: {
              title: "Listing",
              url: "https://example.com/past",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    render(
      <PublicShell>
        <SavedPage />
      </PublicShell>,
    );

    const saved = await screen.findByRole("region", { name: /^saved$/i });
    const attended = within(saved).getByRole("heading", { name: /^attended$/i });
    const attendedEvent = within(saved).getByRole("heading", { name: /attended night/i });
    expect(
      attended.compareDocumentPosition(attendedEvent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(saved).getByRole("link", { name: /attended night/i })).toHaveAttribute(
      "href",
      "https://example.com/attended",
    );
    const attendedRow = attendedEvent.closest("li");
    expect(attendedRow).not.toBeNull();
    expect(
      within(attendedRow!).getByRole("button", { name: /^attended$/i }),
    ).toHaveAttribute("aria-pressed", "true");

    const dismissed = within(saved).getByRole("heading", { name: /^dismissed$/i });
    const dismissedEvent = await within(saved).findByRole("heading", {
      name: /dismissed night/i,
    });
    expect(
      dismissed.compareDocumentPosition(dismissedEvent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(saved).queryByRole("heading", { name: /already over/i }),
    ).not.toBeInTheDocument();
    expect(within(saved).queryByText(/event_gone/i)).not.toBeInTheDocument();
    const dismissedRow = dismissedEvent.closest("li");
    expect(dismissedRow).not.toBeNull();
    await user.click(within(dismissedRow!).getByRole("button", { name: /^restore$/i }));
    expect(
      within(saved).queryByRole("heading", { name: /dismissed night/i }),
    ).not.toBeInTheDocument();
  });
});
