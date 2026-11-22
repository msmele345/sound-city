import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { navigationStub } from "@/test/navigation-stub";

vi.mock("next/link", () => ({
  default: function NextLink({
    href,
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
  }) {
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
        }}
      >
        {children}
      </a>
    );
  },
}));

import { ArtistsView } from "./dashboard/artists-view";
import { EventsView } from "./dashboard/events-view";
import { HomeView } from "./dashboard/home-view";
import { PublicShell } from "./dashboard/public-shell";

function renderSharedDiscovery() {
  return render(
    <PublicShell>
      <HomeView />
      <EventsView />
      <ArtistsView />
    </PublicShell>,
  );
}

function renderHome() {
  return render(
    <PublicShell>
      <HomeView />
    </PublicShell>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
});

describe("public home", () => {
  it("presents the launch dashboard regions for discovery", () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ city: { slug: "chicago" }, events: [] }),
    });

    renderHome();

    expect(
      screen.getByRole("heading", { name: /sound city/i }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", { name: /for you/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /next up/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /artist showcase/i }),
    ).toBeInTheDocument();
    expect(
      within(main).queryByRole("heading", { name: /venue signals/i }),
    ).not.toBeInTheDocument();
  });

  it("replaces the event feed with the next five events linking to the events route", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        city: { slug: "chicago" },
        events: ["Six", "One", "Two", "Three", "Four", "Five"].map((name) => ({
          id: `event_${name.toLowerCase()}`,
          title: `Night ${name}`,
          startsAt: `2026-05-${
            { One: "22", Two: "23", Three: "24", Four: "25", Five: "26", Six: "27" }[
              name
            ]
          }T02:00:00.000Z`,
          venue: { name: "smartbar", neighborhood: "Wrigleyville" },
          artists: [{ name: "Posthuman" }],
          styles: ["techno"],
          source: {
            title: "Resident Advisor listing",
            url: "https://ra.co/events/2412925",
            lastVerifiedAt: "2026-05-15",
          },
        })),
      }),
    });

    renderHome();

    expect(
      screen.queryByRole("region", { name: /latest events/i }),
    ).not.toBeInTheDocument();

    const nextUp = screen.getByRole("region", { name: /next up/i });
    expect(
      within(nextUp).getByRole("link", { name: /all events/i }),
    ).toHaveAttribute("href", "/events");
    expect(
      await within(nextUp).findByRole("heading", { name: /night one/i }),
    ).toBeInTheDocument();
    expect(
      within(nextUp).getByRole("heading", { name: /night five/i }),
    ).toBeInTheDocument();
    expect(
      within(nextUp).queryByRole("heading", { name: /night six/i }),
    ).not.toBeInTheDocument();
  });

  it("says nothing is on tonight and links to the next date with events", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-21T18:00:00.000Z"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "event_tomorrow",
            title: "Next Night",
            startsAt: "2026-05-23T03:00:00.000Z",
            venue: { name: "Podlasie Club", neighborhood: "Avondale" },
            artists: [{ name: "Local House Selector" }],
            styles: ["house"],
            source: {
              title: "Listing",
              url: "https://example.com/next",
              lastVerifiedAt: "2026-05-15",
            },
          },
        ],
      }),
    });

    try {
      renderHome();
      const forYou = screen.getByRole("region", { name: /for you/i });
      expect(await within(forYou).findByText(/nothing on tonight/i)).toBeInTheDocument();
      expect(within(forYou).getByRole("link", { name: /tomorrow/i })).toHaveAttribute(
        "href",
        "/events#day-2026-05-22",
      );
      expect(
        within(forYou).getByRole("heading", { name: /^next night$/i }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed recommendation feed", async () => {
    const user = userEvent.setup();
    let eventCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        eventCalls += 1;
        if (eventCalls === 1) {
          return Promise.resolve({ ok: false, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: [
              {
                id: "event_back",
                title: "Back Online",
                startsAt: "2026-05-24T03:00:00.000Z",
                venue: { name: "Spybar", neighborhood: "River North" },
                artists: [],
                styles: ["house"],
                source: {
                  title: "Listing",
                  url: "https://example.com/back",
                  lastVerifiedAt: "2026-05-15",
                },
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ artists: [], venues: [], artist: null }),
      });
    });

    renderHome();
    const forYou = screen.getByRole("region", { name: /for you/i });
    expect(await within(forYou).findByRole("alert")).toHaveTextContent(
      /recommendation queue is unavailable/i,
    );
    await user.click(within(forYou).getByRole("button", { name: /^retry$/i }));
    expect(
      await within(forYou).findByRole("heading", { name: /back online/i }),
    ).toBeInTheDocument();
    expect(eventCalls).toBe(2);
  });

  it("announces home list loading with skeleton rows", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderHome();

    for (const name of [
      /loading recommendation queue/i,
      /loading next events/i,
      /loading weekly artist showcase/i,
    ]) {
      const loading = screen.getByRole("status", { name });
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(
        within(loading).getAllByRole("listitem", { hidden: true }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("hides masthead counts while the catalog is loading", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderHome();

    const header = screen.getByRole("banner");
    expect(within(header).queryByText(/^events$/i)).not.toBeInTheDocument();
    expect(within(header).queryByText(/^venues$/i)).not.toBeInTheDocument();
    expect(within(header).queryByText(/^neighborhoods$/i)).not.toBeInTheDocument();
  });

  it("shows upcoming event, venue, and neighborhood counts from the catalog", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: [
              {
                id: "event_1",
                title: "Night One",
                startsAt: "2026-05-22T02:00:00.000Z",
                venue: { name: "smartbar", neighborhood: "Wrigleyville" },
                artists: [{ name: "Posthuman" }],
                styles: ["techno"],
                source: {
                  title: "Listing",
                  url: "https://example.com/1",
                  lastVerifiedAt: "2026-05-15",
                },
              },
              {
                id: "event_2",
                title: "Night Two",
                startsAt: "2026-05-23T02:00:00.000Z",
                venue: { name: "Spybar", neighborhood: "West Loop" },
                artists: [{ name: "Lemtom" }],
                styles: ["house"],
                source: {
                  title: "Listing",
                  url: "https://example.com/2",
                  lastVerifiedAt: "2026-05-15",
                },
              },
              {
                id: "event_3",
                title: "Night Three",
                startsAt: "2026-05-24T02:00:00.000Z",
                venue: { name: "smartbar", neighborhood: "Wrigleyville" },
                artists: [{ name: "Posthuman" }],
                styles: ["techno"],
                source: {
                  title: "Listing",
                  url: "https://example.com/3",
                  lastVerifiedAt: "2026-05-15",
                },
              },
            ],
          }),
        });
      }

      if (url === "/api/catalog/venues?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            venues: [
              {
                id: "venue_smartbar",
                name: "smartbar",
                slug: "smartbar",
                neighborhood: "Wrigleyville",
                address: "3730 N Clark St",
                capacity: 400,
                source: {
                  title: "smartbar",
                  url: "https://example.com/smartbar",
                  lastVerifiedAt: "2026-05-15",
                },
                signals: [],
              },
              {
                id: "venue_spybar",
                name: "Spybar",
                slug: "spybar",
                neighborhood: "West Loop",
                address: "646 N Franklin St",
                capacity: 200,
                source: {
                  title: "Spybar",
                  url: "https://example.com/spybar",
                  lastVerifiedAt: "2026-05-15",
                },
                signals: [],
              },
            ],
          }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderHome();

    const header = screen.getByRole("banner");
    const events = await within(header).findByText(/^events$/i);
    expect(events.closest("div")).toHaveTextContent("03");
    expect(within(header).getByText(/^venues$/i).closest("div")).toHaveTextContent(
      "02",
    );
    expect(
      within(header).getByText(/^neighborhoods$/i).closest("div"),
    ).toHaveTextContent("02");
    expect(within(header).queryByText("24")).not.toBeInTheDocument();
  });

  it("navigates the primary nav and next-up link without a full page load", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderHome();

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    for (const name of [/for you/i, /events/i, /artists/i, /venues/i]) {
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      fireEvent(within(nav).getByRole("link", { name }), click);
      expect(click.defaultPrevented).toBe(true);
    }

    const allEvents = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("link", { name: /all events/i }), allEvents);
    expect(allEvents.defaultPrevented).toBe(true);

    const admin = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("link", { name: /^admin$/i }), admin);
    expect(admin.defaultPrevented).toBe(false);
  });

  it("moves admin out of the primary nav into the footer", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    expect(within(nav).queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: /^admin$/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("marks the nav item for the current url", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    navigationStub.pathname = "/";

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    const dashboard = within(nav).getByRole("link", { name: /for you/i });

    expect(dashboard).toHaveAttribute("href", "/");
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: /events/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("points the venues item at the venues route and drops venues from home", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    navigationStub.pathname = "/venues";

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    const venues = within(nav).getByRole("link", { name: /venues/i });

    expect(venues).toHaveAttribute("href", "/venues");
    expect(venues).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("region", { name: /venue signals/i }),
    ).not.toBeInTheDocument();
  });

  it("points the artists item at the artists route", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    navigationStub.pathname = "/artists";

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    const artists = within(nav).getByRole("link", { name: /artists/i });

    expect(artists).toHaveAttribute("href", "/artists");
    expect(artists).toHaveAttribute("aria-current", "page");
  });

  it("points the events item at the events route", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    navigationStub.pathname = "/events";

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });
    const events = within(nav).getByRole("link", { name: /events/i });

    expect(events).toHaveAttribute("href", "/events");
    expect(events).toHaveAttribute("aria-current", "page");
  });

  it("does not keep the first nav item current on another route", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    navigationStub.pathname = "/admin";

    renderHome();

    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });

    expect(
      within(nav).getByRole("link", { name: /for you/i }),
    ).not.toHaveAttribute("aria-current");
  });


  it("filters events and the featured artist by canonical techno sub-genre", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: [
              {
                id: "event_melodic",
                title: "Melodic Signal",
                startsAt: "2026-07-01T02:00:00.000Z",
                venue: { name: "Smartbar", neighborhood: "Wrigleyville" },
                artists: [{ name: "Melodic Artist", slug: "melodic-artist" }],
                styles: ["melodic"],
                source: {
                  title: "Melodic listing",
                  url: "https://example.com/melodic",
                  lastVerifiedAt: "2026-06-20",
                },
              },
              {
                id: "event_hard",
                title: "Hard Signal",
                startsAt: "2026-07-02T02:00:00.000Z",
                venue: { name: "Podlasie Club", neighborhood: "Avondale" },
                artists: [{ name: "Hard Artist", slug: "hard-artist" }],
                styles: ["hard"],
                source: {
                  title: "Hard listing",
                  url: "https://example.com/hard",
                  lastVerifiedAt: "2026-06-20",
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
              id: "artist_melodic",
              citySlug: "chicago",
              name: "Melodic Artist",
              slug: "melodic-artist",
              bio: "Melodic techno from Chicago.",
              styles: ["melodic"],
              showcase: true,
              source: {
                title: "Artist source",
                url: "https://example.com/artist",
                lastVerifiedAt: "2026-06-20",
              },
              links: [],
            },
          }),
        });
      }

      if (url === "/api/catalog/artists?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            artists: [
              {
                id: "artist_melodic",
                citySlug: "chicago",
                name: "Melodic Artist",
                slug: "melodic-artist",
                bio: "Melodic techno from Chicago.",
                styles: ["melodic"],
                showcase: true,
                source: {
                  title: "Melodic artist source",
                  url: "https://example.com/artists/melodic",
                  lastVerifiedAt: "2026-06-20",
                },
                links: [],
              },
              {
                id: "artist_hard",
                citySlug: "chicago",
                name: "Hard Artist",
                slug: "hard-artist",
                bio: "Hard techno from Chicago.",
                styles: ["hard"],
                showcase: false,
                source: {
                  title: "Hard artist source",
                  url: "https://example.com/artists/hard",
                  lastVerifiedAt: "2026-06-20",
                },
                links: [],
              },
            ],
          }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({ venues: [] }) });
    });

    navigationStub.search = "style=hard";
    renderSharedDiscovery();

    const latestEvents = screen.getByRole("region", { name: /latest events/i });
    const artistShowcase = (
      await screen.findByRole("heading", { name: /artists tagged hard/i })
    ).closest("section");
    expect(artistShowcase).not.toBeNull();

    expect(
      await within(latestEvents).findByRole("heading", { name: /hard signal/i }),
    ).toBeInTheDocument();
    expect(
      within(latestEvents).queryByRole("heading", { name: /melodic signal/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^tune$/i }));
    for (const style of ["melodic", "groovy", "hard", "trance"]) {
      expect(
        within(latestEvents).getByRole("button", { name: style }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: style }),
      ).toBeInTheDocument();
    }
    expect(
      within(artistShowcase!).queryByRole("heading", { name: /melodic artist/i }),
    ).not.toBeInTheDocument();
    expect(artistShowcase).toHaveTextContent(/no featured artist matches hard/i);
    expect(
      within(artistShowcase!).getByRole("heading", { name: /hard artist/i }),
    ).toBeInTheDocument();
  });

  it("does not duplicate the showcase artist in the style matches list", async () => {
    navigationStub.search = "style=melodic";
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: [
              {
                id: "event_melodic",
                title: "Melodic Signal",
                startsAt: "2026-07-01T02:00:00.000Z",
                venue: { name: "Smartbar", neighborhood: "Wrigleyville" },
                artists: [{ name: "Melodic Artist", slug: "melodic-artist" }],
                styles: ["melodic"],
                source: {
                  title: "Melodic listing",
                  url: "https://example.com/melodic",
                  lastVerifiedAt: "2026-06-20",
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
              id: "artist_melodic",
              citySlug: "chicago",
              name: "Melodic Artist",
              slug: "melodic-artist",
              bio: "Melodic techno from Chicago.",
              styles: ["melodic"],
              showcase: true,
              source: {
                title: "Artist source",
                url: "https://example.com/artist",
                lastVerifiedAt: "2026-06-20",
              },
              links: [],
            },
          }),
        });
      }

      if (url === "/api/catalog/artists?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            artists: [
              {
                id: "artist_melodic",
                citySlug: "chicago",
                name: "Melodic Artist",
                slug: "melodic-artist",
                bio: "Melodic techno from Chicago.",
                styles: ["melodic"],
                showcase: true,
                source: {
                  title: "Melodic artist source",
                  url: "https://example.com/artists/melodic",
                  lastVerifiedAt: "2026-06-20",
                },
                links: [],
              },
              {
                id: "artist_melodic_other",
                citySlug: "chicago",
                name: "Other Melodic Artist",
                slug: "other-melodic-artist",
                bio: "Another melodic techno act.",
                styles: ["melodic"],
                showcase: false,
                source: {
                  title: "Other melodic source",
                  url: "https://example.com/artists/other-melodic",
                  lastVerifiedAt: "2026-06-20",
                },
                links: [],
              },
            ],
          }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({ venues: [] }) });
    });

    renderSharedDiscovery();

    const styleMatchesHeading = await screen.findByRole("heading", {
      name: /artists tagged melodic/i,
    });
    const styleMatchesList = styleMatchesHeading.closest("div");

    expect(
      within(styleMatchesList!).getByRole("heading", {
        name: /other melodic artist/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(styleMatchesList!).queryByRole("heading", {
        name: /^melodic artist$/i,
      }),
    ).not.toBeInTheDocument();
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

    const { unmount } = renderHome();

    await user.click(screen.getByRole("button", { name: /^tune$/i }));
    await user.click(await screen.findByRole("checkbox", { name: /acid/i }));

    const recommended = screen.getByRole("region", {
      name: /for you/i,
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
    renderHome();

    await user.click(screen.getByRole("button", { name: /^tune$/i }));
    expect(await screen.findByRole("checkbox", { name: /acid/i })).toBeChecked();
    const restoredRecommendations = screen.getByRole("region", {
      name: /for you/i,
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

  it("shows public source freshness and source links on recommended events", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T16:00:00.000Z"));
    try {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          city: { slug: "chicago" },
          events: [
            {
              id: "event_recommended",
              title: "Recommended Source Test",
              startsAt: "2026-05-23T03:00:00.000Z",
              venue: {
                name: "Podlasie Club",
                neighborhood: "Avondale",
                capacity: 220,
              },
              artists: [{ name: "Local Selector" }],
              styles: ["house"],
              source: {
                title: "Venue calendar",
                url: "https://example.com/calendar",
                lastVerifiedAt: "2026-05-15",
                confidence: 94,
              },
            },
          ],
        }),
      });

      renderHome();

      const recommended = screen.getByRole("region", {
        name: /for you/i,
      });
      const eventHeading = await within(recommended).findByRole("heading", {
        name: /recommended source test/i,
      });
      const eventRow = eventHeading.closest("li");
      expect(eventRow).not.toBeNull();
      expect(within(eventRow!).getByText(/^verified may 15$/i)).toBeInTheDocument();
      expect(
        within(eventRow!).getByRole("link", { name: /^venue calendar$/i }),
      ).toHaveAttribute("href", "https://example.com/calendar");
      expect(within(eventRow!).queryByText(/confidence/i)).not.toBeInTheDocument();
      expect(within(eventRow!).queryByText(/parser/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads the weekly artist feature on the home page", async () => {
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

    renderHome();

    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/showcase?city=chicago");

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
    expect(
      within(showcase).getByRole("link", { name: /^family matters$/i }),
    ).toHaveAttribute("href", "https://example.com/event");
    expect(
      screen.queryByRole("region", { name: /venue signals/i }),
    ).not.toBeInTheDocument();
  });
});
