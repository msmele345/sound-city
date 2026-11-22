import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ArtistsPage from "@/app/(public)/artists/page";
import { navigationStub } from "@/test/navigation-stub";

import { PublicShell } from "./public-shell";

const fetchMock = vi.fn();

const posthuman = {
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
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
  navigationStub.pathname = "/artists";
});

describe("Artists route", () => {
  it("announces artist loading with skeleton rows", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    render(
      <PublicShell>
        <ArtistsPage />
      </PublicShell>,
    );

    for (const name of [/loading weekly artist showcase/i, /loading artist style matches/i]) {
      const loading = screen.getByRole("status", { name });
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(
        within(loading).getAllByRole("listitem", { hidden: true }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("renders the weekly feature and the artist directory", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/showcase?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ artist: posthuman }),
        });
      }
      if (url === "/api/catalog/artists?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            artists: [
              posthuman,
              {
                ...posthuman,
                id: "artist_local",
                name: "Local Selector",
                slug: "local-selector",
                showcase: false,
                links: [
                  {
                    id: "link_local_bandcamp",
                    kind: "bandcamp",
                    label: "Bandcamp",
                    url: "https://example.com/local",
                    source: posthuman.source,
                  },
                ],
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ events: [], venues: [] }),
      });
    });

    render(
      <PublicShell>
        <ArtistsPage />
      </PublicShell>,
    );

    const showcase = screen.getByRole("region", { name: /artist showcase/i });
    expect(
      await within(showcase).findByRole("heading", { name: /^posthuman$/i }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("link", { name: /resident advisor profile/i }),
    ).toHaveAttribute("href", "https://example.com/posthuman");
    expect(
      within(showcase).getByRole("heading", { name: /artist directory/i }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("heading", { name: /local selector/i }),
    ).toBeInTheDocument();
    expect(
      within(showcase).getByRole("link", { name: /bandcamp/i }),
    ).toHaveAttribute("href", "https://example.com/local");
    expect(
      within(showcase).getAllByRole("heading", { name: /^posthuman$/i }),
    ).toHaveLength(1);
  });

  it("shares the style filter with events and carries it in the nav", async () => {
    const user = userEvent.setup();
    navigationStub.pathname = "/artists";
    navigationStub.search = "style=hard";
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: [
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
          json: async () => ({ artist: posthuman }),
        });
      }
      if (url === "/api/catalog/artists?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            artists: [
              posthuman,
              {
                ...posthuman,
                id: "artist_hard",
                name: "Hard Artist",
                slug: "hard-artist",
                styles: ["hard"],
                showcase: false,
                links: [],
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ venues: [] }) });
    });

    render(
      <PublicShell>
        <ArtistsPage />
      </PublicShell>,
    );

    const showcase = screen.getByRole("region", { name: /artist showcase/i });
    const hardFilter = await within(showcase).findByRole("button", { name: /^hard$/i });
    expect(hardFilter).toHaveAttribute("aria-pressed", "true");
    expect(showcase).toHaveTextContent(/no featured artist matches hard/i);
    expect(
      within(showcase).getByRole("heading", { name: /hard artist/i }),
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(within(nav).getByRole("link", { name: /events/i })).toHaveAttribute(
      "href",
      "/events?style=hard",
    );
    const artists = within(nav).getByRole("link", { name: /artists/i });
    expect(artists).toHaveAttribute("href", "/artists?style=hard");
    expect(artists).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /for you/i })).toHaveAttribute(
      "href",
      "/?style=hard",
    );
    expect(within(nav).getByRole("link", { name: /venues/i })).toHaveAttribute(
      "href",
      "/venues",
    );

    await user.click(within(showcase).getByRole("button", { name: /^melodic$/i }));
    expect(navigationStub.replace).toHaveBeenCalledWith("/artists?style=melodic", {
      scroll: false,
    });
  });
});
