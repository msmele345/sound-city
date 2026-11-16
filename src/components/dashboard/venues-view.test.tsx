import { render, screen, within } from "@testing-library/react";

import VenuesPage from "@/app/(public)/venues/page";
import { navigationStub } from "@/test/navigation-stub";

import { PublicShell } from "./public-shell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
  navigationStub.pathname = "/venues";
});

describe("Venues route", () => {
  it("renders the venue directory", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/catalog/events?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
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

      if (url === "/api/catalog/venues?city=chicago") {
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
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <PublicShell>
        <VenuesPage />
      </PublicShell>,
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/venues?city=chicago");

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
    expect(
      within(venues).getByRole("link", { name: /family matters listing/i }),
    ).toHaveAttribute("href", "https://example.com/event");
  });
});
