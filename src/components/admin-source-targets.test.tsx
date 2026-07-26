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
      failureCount: 0,
      rejectionCount: 0,
      duplicateCount: 0,
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
  it("keeps header navigation clickable above the display masthead", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => refreshSnapshot });

    render(<AdminSourceTargets allowDevParser={false} />);

    const dashboardLink = screen.getByRole("link", {
      name: /back to dashboard/i,
    });
    const catalogLink = screen.getByRole("link", {
      name: /admin catalog/i,
    });
    const masthead = await screen.findByRole("heading", {
      name: /source targets/i,
    });

    expect(dashboardLink).toHaveAttribute("href", "/");
    expect(catalogLink).toHaveAttribute("href", "/admin");
    expect(masthead).toHaveClass("pointer-events-none");
  });

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
    expect(options).toContain("rss-event-feed");
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

  it("runs a manual refresh and shows run logs with review lanes", async () => {
    const user = userEvent.setup();
    const refreshBody = {
      runs: [
        {
          id: "refresh_run_city_chicago_1",
          cityId: "city_chicago",
          trigger: "manual",
          status: "succeeded",
          triggeredBy: "admin-secret",
          startedAt: "2026-06-12T10:00:00.000Z",
          finishedAt: "2026-06-12T10:00:01.000Z",
          sourceTargetsChecked: 1,
          sourceTargetsFailed: 0,
          draftsCreated: 1,
          updatesProposed: 1,
          duplicatesFlagged: 1,
          staleTasksCreated: 1,
          errorSummary: null,
          createdAt: "2026-06-12T10:00:00.000Z",
        },
      ],
      logsByRun: {
        refresh_run_city_chicago_1: [
          {
            id: "log_1",
            runId: "refresh_run_city_chicago_1",
            sourceTargetId: "source_target_smartbar_calendar",
            level: "info",
            message: "Dev parser created 4 review items",
            metadata: null,
            createdAt: "2026-06-12T10:00:01.000Z",
          },
        ],
      },
      reviewItems: [
        {
          id: "review_item_1",
          runId: "refresh_run_city_chicago_1",
          lane: "new-event",
          status: "pending",
          priority: 80,
          confidence: 86,
          normalizedDraft: { title: "Late Shift Control Room" },
          evidence: { sourceUrls: ["https://fixtures.test"], excerpts: [], contentHashes: [] },
        },
        {
          id: "review_item_2",
          runId: "refresh_run_city_chicago_1",
          lane: "proposed-update",
          status: "pending",
          priority: 70,
          confidence: 78,
          normalizedDraft: { title: "Bunker Signal" },
          evidence: { sourceUrls: ["https://fixtures.test"], excerpts: [], contentHashes: [] },
        },
      ],
    };

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago" && !init?.method) {
        return Promise.resolve({ ok: true, json: async () => refreshBody });
      }
      if (
        url === "/api/admin/refresh-runs?city=chicago" &&
        init?.method === "POST"
      ) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            run: refreshBody.runs[0],
            logs: refreshBody.logsByRun.refresh_run_city_chicago_1,
            reviewItems: refreshBody.reviewItems,
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);

    await user.click(
      await screen.findByRole("button", { name: /run refresh/i }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/refresh-runs?city=chicago",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText(/dev parser created 4 review items/i)).toBeInTheDocument();
    expect(screen.getByText(/new event/i)).toBeInTheDocument();
    const newEventTitle = screen.getByRole("button", {
      name: /late shift control room/i,
    });
    expect(newEventTitle).toHaveClass("block", "w-full", "truncate");
    const newEventActions = screen.getByRole("group", {
      name: /actions for late shift control room/i,
    });
    expect(within(newEventActions).getByRole("button", { name: /approve/i }))
      .toBeInTheDocument();
    expect(within(newEventActions).getByRole("button", { name: /reject/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/proposed update/i)).toBeInTheDocument();
    expect(screen.getByText(/bunker signal/i)).toBeInTheDocument();
  });

  it("summarizes partial refresh runs in source terms", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...refreshSnapshot,
            targets: [
              refreshSnapshot.targets[0],
              {
                ...refreshSnapshot.targets[0],
                id: "source_target_radius_feed",
                url: "https://radius-chicago.com/feed/",
              },
              {
                ...refreshSnapshot.targets[0],
                id: "source_target_calendar",
                url: "https://calendar.test/chicago.ics",
              },
            ],
          }),
        });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            runs: [
              {
                id: "refresh_run_partial",
                status: "partial",
                startedAt: "2026-07-26T10:00:00.000Z",
                finishedAt: "2026-07-26T10:00:03.000Z",
                sourceTargetsChecked: 3,
                sourceTargetsFailed: 1,
                draftsCreated: 1,
                updatesProposed: 0,
                duplicatesFlagged: 0,
                staleTasksCreated: 0,
                errorSummary: "Calendar fetch timed out",
              },
            ],
            outcomesByRun: {
              refresh_run_partial: [
                {
                  sourceTargetId: "source_target_smartbar_calendar",
                  status: "succeeded",
                  errorDetails: null,
                },
                {
                  sourceTargetId: "source_target_radius_feed",
                  status: "unchanged",
                  errorDetails: null,
                },
                {
                  sourceTargetId: "source_target_calendar",
                  status: "failed",
                  errorDetails: {
                    code: null,
                    message: "Calendar fetch timed out",
                  },
                },
              ],
            },
            logsByRun: {},
            reviewItems: [],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    const runHistory = await screen.findByRole("region", {
      name: /refresh run history/i,
    });
    expect(
      within(runHistory).getByText(/2 of 3 sources succeeded/i),
    ).toBeInTheDocument();
  });

  it("shows the failed source target and its compact error", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            runs: [
              {
                id: "refresh_run_failed_target",
                status: "partial",
                startedAt: "2026-07-26T10:00:00.000Z",
                finishedAt: "2026-07-26T10:00:03.000Z",
                sourceTargetsChecked: 1,
                sourceTargetsFailed: 1,
                draftsCreated: 0,
                updatesProposed: 0,
                duplicatesFlagged: 0,
                staleTasksCreated: 0,
                errorSummary: "1 source failed",
              },
            ],
            outcomesByRun: {
              refresh_run_failed_target: [
                {
                  sourceTargetId: "source_target_smartbar_calendar",
                  status: "failed",
                  errorDetails: {
                    code: "FETCH_TIMEOUT",
                    message: "Request timed out after 15 seconds",
                  },
                },
              ],
            },
            logsByRun: {},
            reviewItems: [],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    const failedTarget = await screen.findByRole("listitem", {
      name: /smartbarchicago\.com\/calendar failed target/i,
    });
    expect(failedTarget).toHaveTextContent(/request timed out after 15 seconds/i);
  });

  it("shows an operational warning after one consecutive source failure", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...refreshSnapshot,
            healthByTarget: {
              source_target_smartbar_calendar: {
                status: "healthy",
                consecutiveFailures: 1,
                consecutiveSuccesses: 0,
                warning: "1 consecutive source failure",
              },
            },
          }),
        });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            runs: [],
            outcomesByRun: {},
            logsByRun: {},
            reviewItems: [],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    expect(
      await screen.findByRole("status", {
        name: /smartbarchicago\.com\/calendar health warning/i,
      }),
    ).toHaveTextContent(/warning.*1 consecutive source failure/i);
    expect(
      screen.getByText(/does not change enablement, trust, or confidence/i),
    ).toBeInTheDocument();
  });

  it("shows target outcomes immediately after a manual refresh", async () => {
    const user = userEvent.setup();
    let refreshHistoryReads = 0;
    const run = {
      id: "refresh_run_manual_partial",
      status: "partial",
      startedAt: "2026-07-26T10:00:00.000Z",
      finishedAt: "2026-07-26T10:00:03.000Z",
      sourceTargetsChecked: 1,
      sourceTargetsFailed: 1,
      draftsCreated: 0,
      updatesProposed: 0,
      duplicatesFlagged: 0,
      staleTasksCreated: 0,
      errorSummary: "1 source failed",
    };
    const outcomes = [
      {
        sourceTargetId: "source_target_smartbar_calendar",
        status: "failed",
        errorDetails: {
          code: "FETCH_TIMEOUT",
          message: "Request timed out after 15 seconds",
        },
      },
    ];

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (
        url === "/api/admin/refresh-runs?city=chicago" &&
        init?.method === "POST"
      ) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ run, outcomes, logs: [], reviewItems: [] }),
        });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        refreshHistoryReads += 1;
        if (refreshHistoryReads === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              runs: [],
              outcomesByRun: {},
              logsByRun: {},
              reviewItems: [],
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({ error: "Refresh history reload unavailable" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser={false} />);

    await user.click(
      await screen.findByRole("button", { name: /run refresh/i }),
    );

    const runHistory = screen.getByRole("region", {
      name: /refresh run history/i,
    });
    expect(
      within(runHistory).getByText(/0 of 1 sources succeeded/i),
    ).toBeInTheDocument();
    const failedTarget = within(runHistory).getByRole("listitem", {
      name: /smartbarchicago\.com\/calendar failed target/i,
    });
    expect(failedTarget).toHaveTextContent(/request timed out after 15 seconds/i);
  });

  it("approves edits from the current draft form values", async () => {
    const user = userEvent.setup();
    const reviewItem = {
      id: "review_item_edit",
      runId: "refresh_run_city_chicago_1",
      lane: "new-event",
      status: "pending",
      priority: 80,
      confidence: 86,
      normalizedDraft: {
        title: "Original Warehouse Night",
        venueSlug: "smartbar",
        startsAt: "2026-06-13T22:00:00.000Z",
        styles: ["house"],
      },
      evidence: {
        sourceUrls: ["https://fixtures.test"],
        excerpts: [],
        contentHashes: [],
      },
    };
    const refreshBody = {
      runs: [],
      logsByRun: {},
      reviewItems: [reviewItem],
    };

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshBody });
      }
      if (url === "/api/admin/review-items" && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reviewItem: { ...reviewItem, status: "approved" },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);

    await user.click(await screen.findByText("Original Warehouse Night"));

    const editForm = screen.getByRole("form", {
      name: /edit original warehouse night/i,
    });
    const titleInput = within(editForm).getByLabelText("title");
    await user.clear(titleInput);
    await user.type(titleInput, "Revised Warehouse Night");
    await user.click(
      within(editForm).getByRole("button", { name: /approve with edits/i }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/review-items",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"title":"Revised Warehouse Night"'),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/review-items",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"title":"Original Warehouse Night"'),
      }),
    );
  });
});
