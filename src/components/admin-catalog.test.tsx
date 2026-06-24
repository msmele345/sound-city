import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminCatalog } from "./admin-catalog";

const fetchMock = vi.fn();

const adminSnapshot = {
  cities: [{ id: "city_chicago", name: "Chicago", slug: "chicago" }],
  venues: [
    {
      id: "venue_smartbar",
      citySlug: "chicago",
      name: "smartbar",
      slug: "smartbar",
      neighborhood: "Wrigleyville",
      address: "3730 N Clark St",
      capacity: 400,
      source: {
        id: "source_smartbar",
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
            id: "source_smartbar",
            title: "smartbar venue page",
            url: "https://example.com/smartbar",
            lastVerifiedAt: "2026-05-15",
          },
        },
      ],
    },
  ],
  artists: [
    {
      id: "artist_posthuman",
      citySlug: "chicago",
      name: "Posthuman",
      slug: "posthuman",
      bio: "Acid and techno act.",
      styles: ["techno", "acid"],
      showcase: true,
      source: {
        id: "source_posthuman",
        title: "Posthuman source",
        url: "https://example.com/posthuman",
        lastVerifiedAt: "2026-05-15",
      },
      links: [
        {
          id: "link_posthuman_ra",
          artistSlug: "posthuman",
          kind: "resident-advisor",
          label: "Resident Advisor profile",
          url: "https://example.com/posthuman-ra",
          source: {
            id: "source_posthuman_ra",
            title: "Resident Advisor profile",
            url: "https://example.com/posthuman-ra",
            lastVerifiedAt: "2026-05-15",
          },
        },
      ],
    },
  ],
  events: [
    {
      id: "event_family_matters",
      citySlug: "chicago",
      title: "Family Matters feat. Posthuman",
      slug: "family-matters-posthuman",
      startsAt: "2026-05-22T02:00:00.000Z",
      venue: { name: "smartbar", slug: "smartbar", neighborhood: "Wrigleyville" },
      artists: [{ name: "Posthuman", slug: "posthuman" }],
      styles: ["techno", "acid"],
      source: {
        id: "source_event",
        title: "Family Matters listing",
        url: "https://example.com/event",
        lastVerifiedAt: "2026-05-15",
      },
    },
  ],
  sources: [
    {
      id: "source_event",
      title: "Family Matters listing",
      url: "https://example.com/event",
      lastVerifiedAt: "2026-05-15",
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminCatalog", () => {
  it("keeps header navigation clickable above the display masthead", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => adminSnapshot });

    render(<AdminCatalog />);

    const dashboardLink = screen.getByRole("link", {
      name: /back to dashboard/i,
    });
    const sourceTargetsLink = screen.getByRole("link", {
      name: /source targets/i,
    });
    const masthead = await screen.findByRole("heading", {
      name: /admin catalog/i,
    });

    expect(dashboardLink).toHaveAttribute("href", "/");
    expect(sourceTargetsLink).toHaveAttribute("href", "/admin/sources");
    expect(masthead).toHaveClass("pointer-events-none");
  });

  it("unlocks protected admin catalog requests with a maintainer secret", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      if (
        headers.get("x-sound-city-admin-secret") !== "phase-seven-secret"
      ) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: "Admin secret required" }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => adminSnapshot,
      });
    });

    render(<AdminCatalog />);

    expect(
      await screen.findByRole("alert", { name: /admin status/i }),
    ).toHaveTextContent(/admin secret required/i);

    const unlockForm = screen.getByRole("form", {
      name: /unlock admin catalog/i,
    });
    await user.type(
      within(unlockForm).getByLabelText(/admin secret/i),
      "phase-seven-secret",
    );
    await user.click(
      within(unlockForm).getByRole("button", { name: /unlock admin/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /^venues$/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/catalog?city=chicago",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-sound-city-admin-secret": "phase-seven-secret",
        }),
      }),
    );
  });

  it("supports quick scanning, creation, validation feedback, and confirmed deletion", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (!init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => adminSnapshot,
        });
      }

      const body = JSON.parse(String(init.body));
      if (body.input?.source?.url === "not-a-url") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "source URL must be a valid URL" }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true }),
      });
    });

    render(<AdminCatalog />);

    expect(
      await screen.findByRole("heading", { name: /admin catalog/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^venues$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^artists$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^events$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /source provenance/i }),
    ).toBeInTheDocument();

    const createVenue = screen.getByRole("form", { name: /^create venue$/i });
    await user.type(within(createVenue).getByLabelText(/venue name/i), "Admin Loft");
    await user.type(within(createVenue).getByLabelText(/venue slug/i), "admin-loft");
    await user.type(within(createVenue).getByLabelText(/neighborhood/i), "Pilsen");
    await user.type(within(createVenue).getByLabelText(/address/i), "123 Admin Ave");
    await user.type(within(createVenue).getByLabelText(/capacity/i), "180");
    await user.type(
      within(createVenue).getByLabelText(/source title/i),
      "Admin Loft calendar",
    );
    await user.type(
      within(createVenue).getByLabelText(/source url/i),
      "https://example.com/admin-loft",
    );
    await user.type(
      within(createVenue).getByLabelText(/last verified/i),
      "2026-05-19",
    );
    await user.click(within(createVenue).getByRole("button", { name: /create/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/catalog",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"entity":"venue"'),
      }),
    );

    const createLink = screen.getByRole("form", {
      name: /^create artist link$/i,
    });
    await user.type(within(createLink).getByLabelText(/^label$/i), "Broken link");
    await user.type(
      within(createLink).getByLabelText(/^link url$/i),
      "https://example.com/link",
    );
    await user.type(
      within(createLink).getByLabelText(/source title/i),
      "Broken source",
    );
    await user.type(within(createLink).getByLabelText(/source url/i), "not-a-url");
    await user.type(
      within(createLink).getByLabelText(/last verified/i),
      "2026-05-19",
    );
    await user.click(within(createLink).getByRole("button", { name: /create/i }));

    expect(
      await screen.findByRole("alert", { name: /admin status/i }),
    ).toHaveTextContent(/valid url/i);

    const eventRow = screen.getByRole("listitem", {
      name: /family matters feat\. posthuman/i,
    });
    await user.click(within(eventRow).getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/delete Family Matters/i),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/catalog",
      expect.objectContaining({
        method: "DELETE",
        body: expect.stringContaining('"entity":"event"'),
      }),
    );
  });
});
