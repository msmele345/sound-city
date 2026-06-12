import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminSourceTargets } from "./admin-source-targets";

const fetchMock = vi.fn();

const refreshSnapshot = {
  owners: [
    {
      id: "source_owner_smartbar",
      cityId: "city_chicago",
      name: "smartbar",
      slug: "smartbar",
      kind: "venue",
      notes: "",
    },
  ],
  targets: [
    {
      id: "source_target_smartbar_calendar",
      ownerId: "source_owner_smartbar",
      cityId: "city_chicago",
      url: "https://smartbarchicago.com/calendar",
      sourceType: "official-venue-calendar",
      parserStrategy: "venue-calendar",
      trustLevel: "primary",
      enabled: true,
      confidenceAdjustment: 0,
      healthStatus: "healthy",
      refreshCadence: "daily",
      lastFetchedAt: null,
      lastSuccessfulRunAt: null,
      lastFailureAt: null,
      lastFailureReason: null,
      notes: "",
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

describe("AdminSourceTargets", () => {
  it("unlocks protected refresh source requests with a maintainer secret", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.get("x-sound-city-admin-secret") !== "phase-two-secret") {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: "Admin secret required" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    expect(
      await screen.findByRole("alert", { name: /source targets status/i }),
    ).toHaveTextContent(/admin secret required/i);

    const unlockForm = screen.getByRole("form", {
      name: /unlock source targets/i,
    });
    await user.type(
      within(unlockForm).getByLabelText(/admin secret/i),
      "phase-two-secret",
    );
    await user.click(
      within(unlockForm).getByRole("button", { name: /unlock admin/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /targets by owner/i }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/source-targets?city=chicago",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-sound-city-admin-secret": "phase-two-secret",
        }),
      }),
    );
  });

  it("groups targets under their owner and hides the dev-static parser outside local/test", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => refreshSnapshot });

    render(<AdminSourceTargets allowDevParser={false} />);

    const ownerSection = await screen.findByRole("region", {
      name: /smartbar source owner/i,
    });
    expect(
      within(ownerSection).getByText(/venue \/ 1 target/i),
    ).toBeInTheDocument();
    expect(
      within(ownerSection).getByText("https://smartbarchicago.com/calendar"),
    ).toBeInTheDocument();

    const createTarget = screen.getByRole("form", {
      name: /create source target/i,
    });
    const parserSelect = within(createTarget).getByLabelText(/parser strategy/i);
    const options = within(parserSelect).getAllByRole("option").map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toContain("venue-calendar");
    expect(options).not.toContain("dev-static");
  });

  it("hides the create-target form until a source owner exists", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ owners: [], targets: [] }),
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    expect(
      await screen.findByText(/create a source owner first/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: /create source target/i }),
    ).not.toBeInTheDocument();
    // The owner form stays available so an owner can be created.
    expect(
      screen.getByRole("form", { name: /create source owner/i }),
    ).toBeInTheDocument();
  });

  it("offers the dev-static parser when allowed", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => refreshSnapshot });

    render(<AdminSourceTargets allowDevParser />);

    const createTarget = await screen.findByRole("form", {
      name: /create source target/i,
    });
    const parserSelect = within(createTarget).getByLabelText(/parser strategy/i);
    const options = within(parserSelect).getAllByRole("option").map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toContain("dev-static");
  });

  it("toggles a target's enabled state", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.method) {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    const targetRow = await screen.findByRole("listitem", {
      name: /smartbarchicago\.com\/calendar source target/i,
    });
    await user.click(within(targetRow).getByRole("button", { name: /disable/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/source-targets",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"enabled":false'),
      }),
    );
  });
});
