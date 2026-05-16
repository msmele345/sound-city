import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DashboardShell } from "./dashboard-shell";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
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
      expect(href).toMatch(/^#/);
      expect(document.querySelector(href!)).not.toBeNull();
    }

    expect(within(nav).getByText(/admin/i).closest("a")).toHaveAttribute(
      "aria-disabled",
      "true",
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
    const eventHeading = await screen.findByRole("heading", {
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

    expect(
      await screen.findByRole("heading", { name: /house night/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /techno night/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /techno/i }));

    expect(
      screen.queryByRole("heading", { name: /house night/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /techno night/i }),
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
});
