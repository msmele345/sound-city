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
      within(editForm).getByRole("button", {
        name: /approve edits and publish/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

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

  it("requires inline confirmation before approving and publishing a new event", async () => {
    const user = userEvent.setup();
    const reviewItem = {
      id: "review_item_confirm",
      runId: "refresh_run_confirm",
      lane: "new-event",
      status: "pending",
      priority: 80,
      confidence: 91,
      normalizedDraft: { title: "Signal Room" },
    };
    let approved = false;

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            runs: [],
            logsByRun: {},
            reviewItems: [
              approved ? { ...reviewItem, status: "approved" } : reviewItem,
            ],
          }),
        });
      }
      if (url === "/api/admin/review-items" && init?.method === "POST") {
        approved = true;
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

    const actions = await screen.findByRole("group", {
      name: /actions for signal room/i,
    });
    await user.click(
      within(actions).getByRole("button", { name: /approve and publish/i }),
    );

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/review-items",
      expect.objectContaining({ method: "POST" }),
    );
    expect(within(actions).getByText(/publish signal room/i)).toBeInTheDocument();

    await user.click(within(actions).getByRole("button", { name: /cancel/i }));
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/review-items",
      expect.objectContaining({ method: "POST" }),
    );

    await user.click(
      within(actions).getByRole("button", { name: /approve and publish/i }),
    );
    await user.click(within(actions).getByRole("button", { name: /confirm/i }));

    expect(
      await screen.findByRole("status", { name: /review action result/i }),
    ).toHaveTextContent("Approved and published: Signal Room");
    expect(screen.queryByText("Signal Room")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view approved/i })).toBeInTheDocument();
  });

  it("prevents duplicate refreshes and keeps a persistent completion summary", async () => {
    const user = userEvent.setup();
    let finishRefresh!: (value: unknown) => void;
    const postResponse = new Promise((resolve) => {
      finishRefresh = resolve;
    });
    const run = {
      id: "refresh_run_feedback",
      status: "succeeded",
      startedAt: "2026-06-19T10:00:00.000Z",
      finishedAt: "2026-06-19T10:00:01.000Z",
      sourceTargetsChecked: 1,
      sourceTargetsFailed: 0,
      draftsCreated: 2,
      updatesProposed: 0,
      duplicatesFlagged: 0,
      staleTasksCreated: 0,
      errorSummary: null,
    };
    const pendingItems = ["One", "Two"].map((title, index) => ({
      id: `review_item_refresh_${index}`,
      runId: run.id,
      lane: "new-event",
      status: "pending",
      priority: 50,
      confidence: 80,
      normalizedDraft: { title },
    }));

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago" && init?.method === "POST") {
        return postResponse;
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ runs: [run], logsByRun: {}, reviewItems: pendingItems }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);
    const refreshButton = await screen.findByRole("button", { name: /run refresh/i });
    await user.click(refreshButton);
    await user.click(refreshButton);

    expect(screen.getByText(/running 1 enabled targets/i)).toBeInTheDocument();
    expect(refreshButton).toBeDisabled();
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === "/api/admin/refresh-runs?city=chicago" &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(1);

    finishRefresh({
      ok: true,
      status: 201,
      json: async () => ({ run, logs: [], reviewItems: pendingItems }),
    });

    const result = await screen.findByRole("status", {
      name: /refresh run result/i,
    });
    expect(result).toHaveTextContent(/refresh succeeded/i);
    expect(result).toHaveTextContent(/2 items need review/i);
    await user.click(within(result).getByRole("button", { name: /view pending/i }));
    expect(screen.getByRole("region", { name: /review lanes/i })).toHaveFocus();
  });

  it("uses action labels that describe each review lane consequence", async () => {
    const lanes = [
      ["new-event", "New", "Approve and publish"],
      ["proposed-update", "Update", "Apply selected changes"],
      ["possible-duplicate", "Duplicate", "Resolve duplicate"],
      ["stale-task", "Stale", "Acknowledge"],
      ["source-health", "Health", "Acknowledge"],
    ] as const;
    const items = lanes.map(([lane, title], index) => ({
      id: `review_lane_${index}`,
      runId: "refresh_lanes",
      lane,
      status: "pending",
      priority: 50,
      confidence: 75,
      normalizedDraft: { title },
      ...(lane === "proposed-update"
        ? { fieldDiffs: { title: { current: "Old", proposed: "Update" } } }
        : {}),
    }));
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ runs: [], logsByRun: {}, reviewItems: items }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);

    for (const [, title, label] of lanes) {
      const actions = await screen.findByRole("group", {
        name: new RegExp(`actions for ${title}`, "i"),
      });
      expect(within(actions).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("prevents duplicate approval requests while an item is submitting", async () => {
    const user = userEvent.setup();
    const item = {
      id: "review_item_slow",
      runId: "refresh_slow",
      lane: "new-event",
      status: "pending",
      priority: 50,
      confidence: 75,
      normalizedDraft: { title: "Slow Signal" },
    };
    let finishApproval!: (value: unknown) => void;
    const approvalResponse = new Promise((resolve) => {
      finishApproval = resolve;
    });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ runs: [], logsByRun: {}, reviewItems: [item] }),
        });
      }
      if (url === "/api/admin/review-items" && init?.method === "POST") {
        return approvalResponse;
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);
    const actions = await screen.findByRole("group", {
      name: /actions for slow signal/i,
    });
    await user.click(within(actions).getByRole("button", { name: /approve and publish/i }));
    const confirm = within(actions).getByRole("button", { name: /^confirm$/i });
    await user.click(confirm);
    await user.click(confirm);

    expect(within(actions).getByRole("button", { name: /approving/i })).toBeDisabled();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/admin/review-items",
      ),
    ).toHaveLength(1);

    finishApproval({
      ok: true,
      json: async () => ({ reviewItem: { ...item, status: "approved" } }),
    });
    expect(
      await screen.findByRole("status", { name: /review action result/i }),
    ).toHaveTextContent(/approved and published/i);
  });

  it("keeps rejection reason and notes after a failed rejection", async () => {
    const user = userEvent.setup();
    const item = {
      id: "review_item_reject",
      runId: "refresh_reject",
      lane: "new-event",
      status: "pending",
      priority: 50,
      confidence: 75,
      normalizedDraft: { title: "Wrong Listing" },
    };
    let rejectionAttempts = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/source-targets?city=chicago") {
        return Promise.resolve({ ok: true, json: async () => refreshSnapshot });
      }
      if (url === "/api/admin/refresh-runs?city=chicago") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            runs: [],
            logsByRun: {},
            reviewItems: [
              rejectionAttempts > 1 ? { ...item, status: "rejected" } : item,
            ],
          }),
        });
      }
      if (url === "/api/admin/review-items" && init?.method === "POST") {
        rejectionAttempts += 1;
        if (rejectionAttempts > 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ reviewItem: { ...item, status: "rejected" } }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Decision could not be saved" }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<AdminSourceTargets allowDevParser />);
    const actions = await screen.findByRole("group", {
      name: /actions for wrong listing/i,
    });
    await user.click(within(actions).getByRole("button", { name: /^reject$/i }));
    const rejectionForm = within(actions).getByRole("form", {
      name: /reject wrong listing/i,
    });
    await user.type(within(rejectionForm).getByLabelText(/reason/i), "Incorrect date");
    await user.type(within(rejectionForm).getByLabelText(/notes/i), "Check venue feed");
    await user.click(within(rejectionForm).getByRole("button", { name: /confirm/i }));

    expect(await within(actions).findByRole("alert")).toHaveTextContent(
      /decision could not be saved/i,
    );
    expect(within(rejectionForm).getByLabelText(/reason/i)).toHaveValue("Incorrect date");
    expect(within(rejectionForm).getByLabelText(/notes/i)).toHaveValue("Check venue feed");

    await user.click(within(rejectionForm).getByRole("button", { name: /confirm/i }));
    expect(
      await screen.findByRole("status", { name: /review action result/i }),
    ).toHaveTextContent("Rejected: Wrong Listing");
    expect(screen.getByRole("button", { name: /view rejected/i })).toBeInTheDocument();
  });
});
