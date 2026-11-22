import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EventsPage from "@/app/(public)/events/page";
import { navigationStub } from "@/test/navigation-stub";

import { HomeView } from "./home-view";
import { PublicShell } from "./public-shell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
  navigationStub.pathname = "/events";
});

function renderEvents() {
  return render(
    <PublicShell>
      <EventsPage />
    </PublicShell>,
  );
}

describe("Events route", () => {
  it("groups the feed by day and labels today and tomorrow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-21T18:00:00.000Z"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_weekend",
            title: "Weekend",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River North" },
            artists: [],
            styles: ["house"],
            source: {
              title: "Listing",
              url: "https://example.com/weekend",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_late",
            title: "Late Set",
            startsAt: "2026-05-22T02:00:00.000Z",
            venue: { name: "smartbar", neighborhood: "Wrigleyville" },
            artists: [],
            styles: ["techno"],
            source: {
              title: "Listing",
              url: "https://example.com/late",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_next",
            title: "Next Night",
            startsAt: "2026-05-23T03:00:00.000Z",
            venue: { name: "Podlasie Club", neighborhood: "Avondale" },
            artists: [],
            styles: ["house"],
            source: {
              title: "Listing",
              url: "https://example.com/next",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_later",
            title: "Later Set",
            startsAt: "2026-05-22T04:30:00.000Z",
            venue: { name: "smartbar", neighborhood: "Wrigleyville" },
            artists: [],
            styles: ["techno"],
            source: {
              title: "Listing",
              url: "https://example.com/later",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    try {
      renderEvents();
      const feed = screen.getByRole("region", { name: /latest events/i });
      const tonight = await within(feed).findByRole("heading", { name: /^tonight$/i });
      const tomorrow = within(feed).getByRole("heading", { name: /^tomorrow$/i });
      const laterDay = within(feed).getByRole("heading", { name: /^sat, may 23$/i });
      const late = within(feed).getByRole("heading", { name: /^late set$/i });
      const later = within(feed).getByRole("heading", { name: /^later set$/i });
      const next = within(feed).getByRole("heading", { name: /^next night$/i });
      const weekend = within(feed).getByRole("heading", { name: /^weekend$/i });

      expect(within(feed).getAllByRole("heading", { name: /^tonight$/i })).toHaveLength(1);
      expect(tonight.compareDocumentPosition(late) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(late.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(later.compareDocumentPosition(tomorrow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(tomorrow.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(next.compareDocumentPosition(laterDay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(laterDay.compareDocumentPosition(weekend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(feed).queryByText(/nothing on tonight/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads upcoming Chicago events from the catalog API", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T16:00:00.000Z"));
    try {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          city: { slug: "chicago" },
          events: [
            {
              id: "event_family_matters_posthuman",
              title: "Family Matters feat. Posthuman",
              startsAt: "2026-05-22T02:00:00.000Z",
              venue: {
                name: "smartbar",
                neighborhood: "Wrigleyville",
              },
              artists: [{ name: "Posthuman" }],
              styles: ["techno", "house"],
              source: {
                title: "Resident Advisor listing",
                url: "https://ra.co/events/2412925",
                lastVerifiedAt: "2026-05-15",
              },
            },
          ],
        }),
      });

      renderEvents();

      expect(fetchMock).toHaveBeenCalledWith("/api/catalog/events?city=chicago");
      const latestEvents = screen.getByRole("region", {
        name: /latest events/i,
      });
      const eventHeading = await within(latestEvents).findByRole("heading", {
        name: /family matters feat\. posthuman/i,
      });
      const eventRow = eventHeading.closest("li");
      expect(eventRow).not.toBeNull();
      expect(within(eventRow!).getByText(/smartbar/i)).toBeInTheDocument();
      expect(within(eventRow!).getByText(/wrigleyville/i)).toBeInTheDocument();
      expect(within(eventRow!).getAllByText(/posthuman/i)).toHaveLength(2);
      expect(within(eventRow!).getByText(/techno \/ house/i)).toBeInTheDocument();
      expect(within(eventRow!).getByText(/^verified may 15$/i)).toBeInTheDocument();
      const source = within(eventRow!).getByRole("link", { name: /^resident advisor$/i });
      expect(source).toHaveAttribute("href", "https://ra.co/events/2412925");
      expect(source).toHaveAccessibleName("Resident Advisor");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a linked style filter from the url", async () => {
    navigationStub.search = "style=techno";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_house",
            title: "House Night",
            startsAt: "2026-05-23T02:00:00.000Z",
            venue: { name: "Podlasie Club", neighborhood: "Avondale" },
            artists: [{ name: "Local House Selector" }],
            styles: ["house"],
            source: {
              title: "House listing",
              url: "https://example.com/house",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_techno",
            title: "Techno Night",
            startsAt: "2026-05-24T02:00:00.000Z",
            venue: { name: "smartbar", neighborhood: "Wrigleyville" },
            artists: [{ name: "Local Techno Selector" }],
            styles: ["techno"],
            source: {
              title: "Techno listing",
              url: "https://example.com/techno",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    renderEvents();

    const latestEvents = screen.getByRole("region", {
      name: /latest events/i,
    });
    expect(
      await within(latestEvents).findByRole("heading", { name: /techno night/i }),
    ).toBeInTheDocument();
    expect(
      within(latestEvents).queryByRole("heading", { name: /house night/i }),
    ).not.toBeInTheDocument();
    expect(
      within(latestEvents).getByRole("button", { name: /^techno$/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("writes the style filter into the url", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_house",
            title: "House Night",
            startsAt: "2026-05-23T02:00:00.000Z",
            venue: { name: "Podlasie Club", neighborhood: "Avondale" },
            artists: [{ name: "Local House Selector" }],
            styles: ["house"],
            source: {
              title: "House listing",
              url: "https://example.com/house",
              lastVerifiedAt: "2026-05-15",
            },
          },
          {
            id: "event_techno",
            title: "Techno Night",
            startsAt: "2026-05-24T02:00:00.000Z",
            venue: { name: "smartbar", neighborhood: "Wrigleyville" },
            artists: [{ name: "Local Techno Selector" }],
            styles: ["techno"],
            source: {
              title: "Techno listing",
              url: "https://example.com/techno",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    renderEvents();

    const latestEvents = screen.getByRole("region", {
      name: /latest events/i,
    });
    expect(
      await within(latestEvents).findByRole("heading", { name: /house night/i }),
    ).toBeInTheDocument();
    expect(
      within(latestEvents).getByRole("heading", { name: /techno night/i }),
    ).toBeInTheDocument();

    await user.click(
      within(latestEvents).getByRole("button", { name: /^techno$/i }),
    );

    expect(navigationStub.replace).toHaveBeenCalledWith("/events?style=techno", {
      scroll: false,
    });
  });

  it("saves and unsaves an event from the feed", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_lemtom",
            title: "Lemtom",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West" },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Resident Advisor listing",
              url: "https://example.com/lemtom",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    renderEvents();

    const latestEvents = screen.getByRole("region", { name: /latest events/i });
    const row = (
      await within(latestEvents).findByRole("heading", { name: /^lemtom$/i })
    ).closest("li");
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole("button", { name: /^save$/i }));

    expect(within(row!).getByRole("button", { name: /^saved$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row!).getByRole("heading", { name: /^lemtom$/i })).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("sound-city.local-profile.v1") ?? "{}")
        .actions.savedEventIds,
    ).toContain("event_lemtom");

    await user.click(within(row!).getByRole("button", { name: /^saved$/i }));

    expect(within(row!).getByRole("button", { name: /^save$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps a dismissed event in the feed with restore and removes it from recommendations", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_lemtom",
            title: "Lemtom",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West", capacity: 200 },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Resident Advisor listing",
              url: "https://example.com/lemtom",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    render(
      <PublicShell>
        <HomeView />
        <EventsPage />
      </PublicShell>,
    );

    const feed = screen.getByRole("region", { name: /latest events/i });
    const row = (await within(feed).findByRole("heading", { name: /^lemtom$/i })).closest(
      "li",
    );
    expect(row).not.toBeNull();
    const recommended = screen.getByRole("region", { name: /for you/i });
    expect(
      within(recommended).getByRole("heading", { name: /^lemtom$/i }),
    ).toBeInTheDocument();

    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));

    expect(within(feed).getByRole("heading", { name: /^lemtom$/i })).toBeInTheDocument();
    expect(within(row!).getByRole("button", { name: /^restore$/i })).toBeInTheDocument();
    expect(
      within(row!).queryByRole("button", { name: /^dismiss$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(recommended).queryByRole("heading", { name: /^lemtom$/i }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("sound-city.local-profile.v1") ?? "{}")
        .actions.dismissedEventIds,
    ).toContain("event_lemtom");

    await user.click(within(row!).getByRole("button", { name: /^restore$/i }));

    expect(within(row!).getByRole("button", { name: /^dismiss$/i })).toBeInTheDocument();
    expect(
      within(recommended).getByRole("heading", { name: /^lemtom$/i }),
    ).toBeInTheDocument();
  });

  it("toggles attended on a feed row and removes it from recommendations while pressed", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_lemtom",
            title: "Lemtom",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West", capacity: 200 },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Resident Advisor listing",
              url: "https://example.com/lemtom",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    render(
      <PublicShell>
        <HomeView />
        <EventsPage />
      </PublicShell>,
    );

    const feed = screen.getByRole("region", { name: /latest events/i });
    const row = (await within(feed).findByRole("heading", { name: /^lemtom$/i })).closest(
      "li",
    );
    expect(row).not.toBeNull();
    const recommended = screen.getByRole("region", { name: /for you/i });

    await user.click(within(row!).getByRole("button", { name: /^attended$/i }));

    expect(within(row!).getByRole("button", { name: /^attended$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(feed).getByRole("heading", { name: /^lemtom$/i })).toBeInTheDocument();
    expect(
      within(recommended).queryByRole("heading", { name: /^lemtom$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(recommended).queryByRole("button", { name: /^attended$/i }),
    ).not.toBeInTheDocument();

    await user.click(within(row!).getByRole("button", { name: /^attended$/i }));

    expect(within(row!).getByRole("button", { name: /^attended$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      within(recommended).getByRole("heading", { name: /^lemtom$/i }),
    ).toBeInTheDocument();
  });

  it("announces each feed action in a polite status", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_lemtom",
            title: "Lemtom",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West", capacity: 200 },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Resident Advisor listing",
              url: "https://example.com/lemtom",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    renderEvents();

    const row = (
      await screen.findByRole("heading", { name: /^lemtom$/i })
    ).closest("li");
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole("button", { name: /^save$/i }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved Lemtom at Spybar");
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(nav.querySelector("[aria-live]")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    await user.click(within(row!).getByRole("button", { name: /^saved$/i }));
    expect(status).toHaveTextContent("Removed Lemtom at Spybar");

    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));
    expect(status).toHaveTextContent("Dismissed Lemtom at Spybar");

    await user.click(within(row!).getByRole("button", { name: /^restore$/i }));
    expect(status).toHaveTextContent("Restored Lemtom at Spybar");

    await user.click(within(row!).getByRole("button", { name: /^attended$/i }));
    expect(status).toHaveTextContent("Attended Lemtom at Spybar");

    await user.click(within(row!).getByRole("button", { name: /^attended$/i }));
    expect(status).toHaveTextContent("Removed attended Lemtom at Spybar");
  });

  it("undoes a dismiss and restores the previous saved state until the next action or navigation", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_lemtom",
            title: "Lemtom",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River West", capacity: 200 },
            artists: [{ name: "Lemtom" }],
            styles: ["house"],
            source: {
              title: "Resident Advisor listing",
              url: "https://example.com/lemtom",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    const { rerender } = renderEvents();
    const row = (
      await screen.findByRole("heading", { name: /^lemtom$/i })
    ).closest("li");
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole("button", { name: /^save$/i }));
    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Dismissed Lemtom at Spybar");
    await user.click(within(status).getByRole("button", { name: /^undo$/i }));

    expect(within(row!).getByRole("button", { name: /^saved$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row!).getByRole("button", { name: /^dismiss$/i })).toBeInTheDocument();
    expect(
      within(status).queryByRole("button", { name: /^undo$/i }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("sound-city.local-profile.v1") ?? "{}")
        .actions.dismissedEventIds ?? [],
    ).not.toContain("event_lemtom");

    await user.click(within(row!).getByRole("button", { name: /^saved$/i }));
    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));
    await user.click(within(status).getByRole("button", { name: /^undo$/i }));
    expect(within(row!).getByRole("button", { name: /^save$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));
    await user.click(within(row!).getByRole("button", { name: /^attended$/i }));
    expect(
      within(status).queryByRole("button", { name: /^undo$/i }),
    ).not.toBeInTheDocument();

    await user.click(within(row!).getByRole("button", { name: /^restore$/i }));
    await user.click(within(row!).getByRole("button", { name: /^dismiss$/i }));
    expect(within(status).getByRole("button", { name: /^undo$/i })).toBeInTheDocument();
    navigationStub.pathname = "/";
    rerender(
      <PublicShell>
        <EventsPage />
      </PublicShell>,
    );
    expect(screen.queryByRole("button", { name: /^undo$/i })).not.toBeInTheDocument();
  });

  it("says nothing is on tonight and links to the next date with events", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-21T18:00:00.000Z"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
            id: "event_weekend",
            title: "Weekend",
            startsAt: "2026-05-24T03:00:00.000Z",
            venue: { name: "Spybar", neighborhood: "River North" },
            artists: [],
            styles: ["house"],
            source: {
              title: "Listing",
              url: "https://example.com/weekend",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    try {
      renderEvents();
      const feed = screen.getByRole("region", { name: /latest events/i });
      expect(await within(feed).findByText(/nothing on tonight/i)).toBeInTheDocument();
      expect(within(feed).getByRole("link", { name: /sat, may 23/i })).toHaveAttribute(
        "href",
        "/events#day-2026-05-23",
      );
      expect(
        within(feed).getByRole("heading", { name: /^sat, may 23$/i }),
      ).toHaveAttribute("id", "day-2026-05-23");
      expect(within(feed).getByRole("heading", { name: /^weekend$/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows loading, empty, and error states for the event feed", async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    const { unmount } = renderEvents();

    const loading = screen.getByRole("status", {
      name: /loading chicago event feed/i,
    });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(
      within(loading).getAllByRole("listitem", { hidden: true }).length,
    ).toBeGreaterThan(0);
    expect(
      within(loading).getAllByRole("listitem", { hidden: true }).every(
        (row) => (row.textContent ?? "").trim() === "",
      ),
    ).toBe(true);
    unmount();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ city: { slug: "chicago" }, events: [] }),
    });

    const emptyView = renderEvents();
    expect(
      await screen.findByText(/no upcoming chicago events are verified yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nothing on tonight/i)).not.toBeInTheDocument();
    emptyView.unmount();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "City not found" }),
    });

    renderEvents();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /event feed is unavailable/i,
    );
  });
});
