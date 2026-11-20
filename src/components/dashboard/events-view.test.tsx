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
  it("loads upcoming Chicago events from the catalog API", async () => {
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
    expect(
      within(eventRow!).getByRole("link", { name: /resident advisor listing/i }),
    ).toHaveAttribute("href", "https://ra.co/events/2412925");
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

  it("shows loading, empty, and error states for the event feed", async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    const { unmount } = renderEvents();

    expect(screen.getByText(/loading chicago event feed/i)).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ city: { slug: "chicago" }, events: [] }),
    });

    const emptyView = renderEvents();
    expect(
      await screen.findByText(/no upcoming chicago events are verified yet/i),
    ).toBeInTheDocument();
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
