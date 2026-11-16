import { render, screen, within } from "@testing-library/react";

import EventsPage from "@/app/(public)/events/page";
import { navigationStub } from "@/test/navigation-stub";

import { PublicShell } from "./public-shell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  window.localStorage.clear();
  navigationStub.pathname = "/events";
});

describe("Events route", () => {
  it("renders the event feed", async () => {
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

    render(
      <PublicShell>
        <EventsPage />
      </PublicShell>,
    );

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
    expect(
      within(eventRow!).getByRole("link", { name: /resident advisor listing/i }),
    ).toHaveAttribute("href", "https://ra.co/events/2412925");
  });
});
