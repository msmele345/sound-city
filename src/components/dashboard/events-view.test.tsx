import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
