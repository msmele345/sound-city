import { render, screen, within } from "@testing-library/react";

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
                links: [],
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
      within(showcase).getAllByRole("heading", { name: /^posthuman$/i }),
    ).toHaveLength(1);
  });
});
