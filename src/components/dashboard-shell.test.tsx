import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DashboardShell } from "./dashboard-shell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
});

describe("DashboardShell", () => {
  it("presents the launch dashboard regions for discovery", () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ city: { slug: "chicago" }, events: [] }),
    });

    render(<DashboardShell />);

    expect(
      screen.getByRole("heading", { name: /sound city/i }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", { name: /recommended tonight/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /latest events/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /artist showcase/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /venue signals/i }),
    ).toBeInTheDocument();
  });

  it("points enabled primary navigation items at existing page sections", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    render(<DashboardShell />);

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    const enabledLinks = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-disabled") !== "true");

    for (const link of enabledLinks) {
      const href = link.getAttribute("href");
      if (href?.startsWith("#")) {
        expect(document.querySelector(href)).not.toBeNull();
      }
    }

    expect(within(nav).getByText(/admin/i).closest("a")).toHaveAttribute(
      "href",
      "/admin",
    );
  });

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

    render(<DashboardShell />);

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

  it("filters loaded events by style", async () => {
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

    render(<DashboardShell />);

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
      within(latestEvents).getByRole("button", { name: /techno/i }),
    );

    expect(
      within(latestEvents).queryByRole("heading", { name: /house night/i }),
    ).not.toBeInTheDocument();
    expect(
      within(latestEvents).getByRole("heading", { name: /techno night/i }),
    ).toBeInTheDocument();
  });

  it("shows loading, empty, and error states for the event feed", async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    const { unmount } = render(<DashboardShell />);

    expect(screen.getByText(/loading chicago event feed/i)).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ city: { slug: "chicago" }, events: [] }),
    });

    const emptyView = render(<DashboardShell />);
    expect(
      await screen.findByText(/no upcoming chicago events are verified yet/i),
    ).toBeInTheDocument();
    emptyView.unmount();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "City not found" }),
    });

    render(<DashboardShell />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /event feed is unavailable/i,
    );
  });

  it("persists local taste preferences and recommendation actions", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: [
          {
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
          },
          {
            id: "event_house_room",
            title: "House Room",
            startsAt: "2026-05-24T02:00:00.000Z",
            venue: {
              name: "Large Room",
              neighborhood: "River North",
              capacity: 900,
            },
            artists: [{ name: "Main Room DJ" }],
            styles: ["house"],
            source: {
              title: "House listing",
              url: "https://example.com/house",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    const { unmount } = render(<DashboardShell />);

    await user.click(await screen.findByRole("checkbox", { name: /acid/i }));

    const recommended = screen.getByRole("region", {
      name: /recommended tonight/i,
    });
    const acidRow = within(recommended)
      .getByRole("heading", { name: /acid room/i })
      .closest("li");
    expect(acidRow).not.toBeNull();

    await user.click(within(acidRow!).getByRole("button", { name: /save/i }));

    const houseRow = within(recommended)
      .getByRole("heading", { name: /house room/i })
      .closest("li");
    expect(houseRow).not.toBeNull();

    await user.click(
      within(houseRow!).getByRole("button", { name: /dismiss/i }),
    );

    expect(
      within(recommended).queryByRole("heading", { name: /house room/i }),
    ).not.toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem("sound-city.local-profile.v1") ?? "{}",
    );
    expect(stored.profile.styles).toContain("acid");
    expect(stored.actions.savedEventIds).toContain("event_acid_room");
    expect(stored.actions.dismissedEventIds).toContain("event_house_room");

    unmount();
    render(<DashboardShell />);

    expect(await screen.findByRole("checkbox", { name: /acid/i })).toBeChecked();
    const restoredRecommendations = screen.getByRole("region", {
      name: /recommended tonight/i,
    });
    expect(
      within(restoredRecommendations).queryByRole("heading", {
        name: /house room/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(restoredRecommendations).getByRole("button", { name: /saved/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("loads the artist showcase and venue directory from catalog APIs", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            city: { slug: "chicago" },
            events: [
              {
                id: "event_posthuman",
                title: "Family Matters feat. Posthuman",
                startsAt: "2026-05-22T02:00:00.000Z",
                venue: {
                  name: "smartbar",
                  slug: "smartbar",
                  neighborhood: "Wrigleyville",
                  capacity: 400,
                },
                artists: [{ name: "Posthuman", slug: "posthuman" }],
                styles: ["techno", "acid"],
                source: {
                  title: "Family Matters listing",
                  url: "https://example.com/event",
                  lastVerifiedAt: "2026-05-15",
                },
              },
            ],
          }),
        });
      }

      if (url === "/api/catalog/showcase?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            artist: {
              id: "artist_posthuman",
              citySlug: "chicago",
              name: "Posthuman",
              slug: "posthuman",
              bio: "Acid and techno act included in smartbar's May 2026 listing.",
              styles: ["techno", "acid"],
              showcase: true,
              source: {
                title: "Artist source",
                url: "https://example.com/artist",
                lastVerifiedAt: "2026-05-15",
              },
              links: [
                {
                  id: "link_posthuman_ra",
                  artistSlug: "posthuman",
                  kind: "resident-advisor",
                  label: "Resident Advisor profile",
                  url: "https://example.com/posthuman",
                  source: {
                    title: "Artist source",
                    url: "https://example.com/artist",
                    lastVerifiedAt: "2026-05-15",
                  },
                },
              ],
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          venues: [
            {
              id: "venue_smartbar",
              citySlug: "chicago",
              name: "smartbar",
              slug: "smartbar",
              neighborhood: "Wrigleyville",
              address: "3730 N Clark St, Chicago, IL 60613",
              capacity: 400,
              source: {
                title: "smartbar venue page",
                url: "https://example.com/smartbar",
                lastVerifiedAt: "2026-05-15",
              },
              signals: [
                {
                  id: "signal_smartbar_sound",
                  venueSlug: "smartbar",
                  category: "sound",
                  value: "Basement room with house and techno-focused programming.",
                  source: {
                    title: "smartbar venue page",
                    url: "https://example.com/smartbar",
                    lastVerifiedAt: "2026-05-15",
                  },
                },
              ],
            },
          ],
        }),
      });
    });

    render(<DashboardShell />);

    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/showcase?city=chicago");
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/venues?city=chicago");

    const showcase = screen.getByRole("region", {
      name: /artist showcase/i,
    });
    expect(
      await within(showcase).findByRole("heading", { name: /^posthuman$/i }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("link", { name: /resident advisor profile/i }),
    ).toHaveAttribute("href", "https://example.com/posthuman");
    expect(
      within(showcase).getByRole("heading", {
        name: /family matters feat\. posthuman/i,
      }),
    ).toBeInTheDocument();

    const venues = screen.getByRole("region", { name: /venue signals/i });
    expect(
      await within(venues).findByRole("heading", { name: /smartbar/i }),
    ).toBeInTheDocument();
    expect(within(venues).getByText(/wrigleyville/i)).toBeInTheDocument();
    expect(
      within(venues).getByText(/basement room with house/i),
    ).toBeInTheDocument();
    expect(
      within(venues).getByRole("heading", {
        name: /family matters feat\. posthuman/i,
      }),
    ).toBeInTheDocument();
  });
});
