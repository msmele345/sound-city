"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type SourceOwnerKind =
  | "listing-platform"
  | "venue"
  | "artist"
  | "promoter"
  | "ticketing";

type SourceType =
  | "resident-advisor"
  | "official-venue-calendar"
  | "artist-social"
  | "ticketing"
  | "other";

type ParserStrategy =
  | "venue-calendar"
  | "artist-social"
  | "resident-advisor"
  | "dev-static";

type TrustLevel = "primary" | "supporting" | "experimental";

type HealthStatus = "healthy" | "degraded" | "failing" | "disabled";

type SourceOwnerRecord = {
  id: string;
  cityId: string;
  name: string;
  slug: string;
  kind: SourceOwnerKind;
  notes: string;
};

type SourceTargetRecord = {
  id: string;
  ownerId: string;
  cityId: string;
  url: string;
  sourceType: SourceType;
  parserStrategy: ParserStrategy;
  trustLevel: TrustLevel;
  enabled: boolean;
  confidenceAdjustment: number;
  healthStatus: HealthStatus;
  failureCount: number;
  rejectionCount: number;
  duplicateCount: number;
  refreshCadence: string;
  lastFetchedAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  notes: string;
};

type SourceSnapshot = {
  owners: SourceOwnerRecord[];
  targets: SourceTargetRecord[];
};

type RefreshRunRecord = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "partial";
  startedAt: string | null;
  finishedAt: string | null;
  sourceTargetsChecked: number;
  sourceTargetsFailed: number;
  draftsCreated: number;
  updatesProposed: number;
  duplicatesFlagged: number;
  staleTasksCreated: number;
  errorSummary: string | null;
};

type RefreshRunLogRecord = {
  id: string;
  runId: string;
  level: "info" | "warning" | "error";
  message: string;
  createdAt: string;
};

type ReviewLane =
  | "new-event"
  | "proposed-update"
  | "possible-duplicate"
  | "stale-task"
  | "source-health";

type ReviewItemRecord = {
  id: string;
  runId: string;
  lane: ReviewLane;
  status: "pending" | "approved" | "rejected";
  priority: number;
  confidence: number;
  normalizedDraft: Record<string, unknown>;
  fieldDiffs?: Record<string, { current: unknown; proposed: unknown }> | null;
  evidence?: { sourceUrls: string[]; excerpts: string[]; contentHashes: string[] };
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  reviewNotes?: string | null;
  publishedEntityId?: string | null;
  publishedSourceId?: string | null;
};

type RefreshRunSnapshot = {
  runs: RefreshRunRecord[];
  logsByRun: Record<string, RefreshRunLogRecord[]>;
  reviewItems: ReviewItemRecord[];
};

type RefreshEntity = "sourceOwner" | "sourceTarget";

const cityId = "city_chicago";

const ownerKinds: SourceOwnerKind[] = [
  "venue",
  "artist",
  "promoter",
  "listing-platform",
  "ticketing",
];

const sourceTypes: SourceType[] = [
  "official-venue-calendar",
  "artist-social",
  "resident-advisor",
  "ticketing",
  "other",
];

const realParserStrategies: ParserStrategy[] = [
  "venue-calendar",
  "artist-social",
  "resident-advisor",
];

const trustLevels: TrustLevel[] = ["primary", "supporting", "experimental"];

const healthStatuses: HealthStatus[] = [
  "healthy",
  "degraded",
  "failing",
  "disabled",
];

const adminSecretHeader = "x-sound-city-admin-secret";
const adminSecretStorageKey = "sound-city.admin-secret.v1";
const reviewLanes: ReviewLane[] = [
  "new-event",
  "proposed-update",
  "possible-duplicate",
  "stale-task",
  "source-health",
];

class RefreshRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof RefreshRequestError && error.status === 401;
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

function formNumber(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? Number(value) : 0;
}

function Field({
  label,
  name,
  defaultValue,
  required = true,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        defaultValue={defaultValue}
        className="mt-2 w-full border border-rule bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
    >
      {children}
    </button>
  );
}

function RowButton({
  onClick,
  children,
}: {
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal"
    >
      {children}
    </button>
  );
}

function SectionHeading({ title, index }: { title: string; index: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-rule-strong pb-2">
      <h2 className="font-display text-2xl uppercase leading-none text-ink sm:text-3xl">
        {title}
      </h2>
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        {index}
      </span>
    </div>
  );
}

function labelFromKebab(value: string) {
  return value.replaceAll("-", " ");
}

function draftTitle(item: ReviewItemRecord) {
  const title = item.normalizedDraft.title;
  return typeof title === "string" && title.trim() ? title : "Untitled draft";
}

function metricLine(run: RefreshRunRecord) {
  return [
    `${run.sourceTargetsChecked} target`,
    `${run.draftsCreated} new`,
    `${run.updatesProposed} update`,
    `${run.duplicatesFlagged} dupe`,
    `${run.staleTasksCreated} stale`,
  ].join(" / ");
}

function healthMetrics(
  runs: RefreshRunRecord[],
  items: ReviewItemRecord[],
  targets: SourceTargetRecord[],
) {
  const enabledTargets = targets.filter((target) => target.enabled).length;
  const lastRun = runs[0];
  const coverage = lastRun
    ? `${lastRun.sourceTargetsChecked}/${enabledTargets}`
    : "—";
  const decided = items.filter(
    (item) => item.status === "approved" || item.status === "rejected",
  );
  const approved = decided.filter((item) => item.status === "approved").length;
  const approvalRate =
    decided.length > 0
      ? `${Math.round((approved / decided.length) * 100)}%`
      : "—";
  return { coverage, approvalRate };
}

// ─── Review Lane Panel ──────────────────────────────────────────────

function ReviewLanePanel({
  lane,
  items,
  pendingCount,
  onApprove,
  onReject,
  onUpdateDraft,
}: {
  lane: ReviewLane;
  items: ReviewItemRecord[];
  pendingCount: number;
  onApprove(
    id: string,
    extra?: {
      acceptedFields?: string[];
      editedDraft?: Record<string, unknown>;
    },
  ): void;
  onReject(id: string, reason: string, notes?: string): void;
  onUpdateDraft(id: string, draft: Record<string, unknown>): void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>({});

  function toggleExpanded(itemId: string) {
    setExpandedItemId((current) => (current === itemId ? null : itemId));
  }

  function toggleField(itemId: string, field: string) {
    setSelectedFields((prev) => {
      const current = prev[itemId] ?? [];
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];
      return { ...prev, [itemId]: next };
    });
  }

  function draftFromForm(form: FormData) {
    const draft: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (
        (key === "styles" || key === "artistSlugs") &&
        typeof value === "string"
      ) {
        try {
          draft[key] = JSON.parse(value);
        } catch {
          draft[key] = value;
        }
      } else {
        draft[key] = value;
      }
    }
    return draft;
  }

  function handleEditSubmit(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault();
    onUpdateDraft(itemId, draftFromForm(new FormData(event.currentTarget)));
  }

  return (
    <section aria-label={`${labelFromKebab(lane)} lane`}>
      <h3 className="font-display text-xl uppercase text-ink">
        {labelFromKebab(lane)}
      </h3>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
        {items.length} shown / {pendingCount} pending
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-dim">No items</p>
      ) : (
        <ol className="mt-2">
          {items.map((item) => (
            <li key={item.id} className="border-t border-rule py-2">
              <div className="grid gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="block w-full truncate text-left text-sm text-ink hover:text-signal"
                  >
                    {draftTitle(item)}
                  </button>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                    {item.status} / {item.confidence}% confidence
                    {item.reviewedAt
                      ? ` / reviewed ${item.reviewedAt.slice(0, 10)}`
                      : ""}
                  </p>
                  {item.rejectionReason ? (
                    <p className="mt-1 text-xs text-ink-dim">
                      Rejected: {item.rejectionReason}
                    </p>
                  ) : null}
                  {item.publishedEntityId ? (
                    <p className="mt-1 font-mono text-[0.68rem] text-ink-dim">
                      Published: {item.publishedEntityId}
                    </p>
                  ) : null}
                </div>

                {item.status === "pending" ? (
                  <div
                    role="group"
                    aria-label={`Actions for ${draftTitle(item)}`}
                    className="flex flex-wrap gap-1"
                  >
                    {item.lane === "proposed-update" && item.fieldDiffs ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const fields = selectedFields[item.id] ?? [];
                            if (fields.length === 0) return;
                            onApprove(item.id, { acceptedFields: fields });
                          }}
                          disabled={(selectedFields[item.id] ?? []).length === 0}
                          className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-signal hover:bg-panel disabled:opacity-40"
                        >
                          Accept selected
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApprove(item.id)}
                        className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-signal hover:bg-panel"
                      >
                        Approve
                      </button>
                    )}
                    <RejectButton
                      onReject={(reason, notes) =>
                        onReject(item.id, reason, notes)
                      }
                    />
                  </div>
                ) : null}
              </div>

              {/* Expanded detail / edit form */}
              {expandedItemId === item.id ? (
                <div className="mt-3 border-t border-rule pt-3">
                  {/* Field-level checkboxes for proposed-update */}
                  {item.lane === "proposed-update" && item.fieldDiffs ? (
                    <div className="mb-3">
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
                        Field changes
                      </p>
                      {Object.entries(item.fieldDiffs).map(([field, diff]) => (
                        <label
                          key={field}
                          className="mt-2 flex items-center gap-2 font-mono text-[0.68rem] text-ink-dim"
                        >
                          <input
                            type="checkbox"
                            checked={(selectedFields[item.id] ?? []).includes(
                              field,
                            )}
                            onChange={() => toggleField(item.id, field)}
                            className="accent-signal"
                          />
                          <span className="uppercase">{field}</span>
                          <span className="text-ink-faint">
                            {JSON.stringify(diff.current)} →{" "}
                            {JSON.stringify(diff.proposed)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {/* Editable draft form for pending items */}
                  {item.status === "pending" ? (
                    <form
                      aria-label={`Edit ${draftTitle(item)}`}
                      onSubmit={(e) => handleEditSubmit(e, item.id)}
                    >
                      <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
                        Edit draft
                      </p>
                      <div className="grid gap-2">
                        {Object.entries(item.normalizedDraft).map(
                          ([key, value]) => (
                            <label
                              key={key}
                              className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-faint"
                            >
                              {key}
                              <input
                                name={key}
                                defaultValue={
                                  typeof value === "string" ||
                                  typeof value === "number"
                                    ? String(value)
                                    : Array.isArray(value)
                                      ? JSON.stringify(value)
                                      : ""
                                }
                                className="mt-1 w-full border border-rule bg-bg px-2 py-1 font-sans text-xs normal-case tracking-normal text-ink"
                              />
                            </label>
                          ),
                        )}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-signal hover:bg-panel"
                        >
                          Save draft
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            const form = event.currentTarget.form;
                            if (!form) return;
                            onApprove(item.id, {
                              editedDraft: draftFromForm(new FormData(form)),
                            });
                          }}
                          className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-signal hover:bg-panel"
                        >
                          Approve with edits
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* Evidence summary */}
                  <div className="mt-3">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
                      Evidence
                    </p>
                    {item.evidence && typeof item.evidence === "object" ? (
                      <ul className="mt-1 space-y-1">
                        {((item.evidence as Record<string, unknown>)
                          .sourceUrls as string[])
                          ?.slice(0, 2)
                          .map((url: string, i: number) => (
                            <li
                              key={i}
                              className="truncate font-mono text-[0.58rem] text-ink-dim"
                            >
                              {url}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RejectButton({
  onReject,
}: {
  onReject(reason: string, notes?: string): void;
}) {
  const [open, setOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    if (!reason) return;
    onReject(reason, notes || undefined);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-dim hover:bg-panel hover:text-signal"
      >
        Reject
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="ml-2 border border-rule p-2"
      aria-label="Reject review item"
    >
      <label className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
        Reason *
        <input
          name="reason"
          required
          className="mt-1 w-full border border-rule bg-bg px-2 py-1 font-sans text-xs normal-case tracking-normal text-ink"
        />
      </label>
      <label className="mt-1 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
        Notes
        <input
          name="notes"
          className="mt-1 w-full border border-rule bg-bg px-2 py-1 font-sans text-xs normal-case tracking-normal text-ink"
        />
      </label>
      <div className="mt-2 flex gap-1">
        <button
          type="submit"
          className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-signal hover:bg-panel"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-rule px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-dim hover:bg-panel"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── AdminSourceTargets ─────────────────────────────────────────────

export function AdminSourceTargets({
  allowDevParser = false,
}: {
  allowDevParser?: boolean;
}) {
  const parserStrategies = useMemo<ParserStrategy[]>(
    () =>
      allowDevParser
        ? [...realParserStrategies, "dev-static"]
        : realParserStrategies,
    [allowDevParser],
  );

  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(adminSecretStorageKey) ?? "";
  });
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [snapshot, setSnapshot] = useState<SourceSnapshot>({
    owners: [],
    targets: [],
  });
  const [refreshSnapshot, setRefreshSnapshot] = useState<RefreshRunSnapshot>({
    runs: [],
    logsByRun: {},
    reviewItems: [],
  });
  const [status, setStatus] = useState("Loading source targets");

  const targetsByOwner = useMemo(() => {
    const grouped = new Map<string, SourceTargetRecord[]>();
    for (const target of snapshot.targets) {
      const existing = grouped.get(target.ownerId) ?? [];
      existing.push(target);
      grouped.set(target.ownerId, existing);
    }
    return grouped;
  }, [snapshot.targets]);

  const adminHeaders = useCallback(
    (secret = adminSecret): HeadersInit => {
      return secret ? { [adminSecretHeader]: secret } : {};
    },
    [adminSecret],
  );

  const readSources = useCallback(
    async (secret = adminSecret) => {
      const response = await fetch("/api/admin/source-targets?city=chicago", {
        headers: adminHeaders(secret),
      });
      const body = (await response.json()) as SourceSnapshot & {
        error?: string;
      };
      if (!response.ok) {
        throw new RefreshRequestError(
          response.status,
          body.error ?? "Source targets unavailable",
        );
      }
      return body;
    },
    [adminHeaders, adminSecret],
  );

  const readRefreshRuns = useCallback(
    async (secret = adminSecret) => {
      const response = await fetch("/api/admin/refresh-runs?city=chicago", {
        headers: adminHeaders(secret),
      });
      const body = (await response.json()) as Partial<RefreshRunSnapshot> & {
        error?: string;
      };
      if (!response.ok) {
        throw new RefreshRequestError(
          response.status,
          body.error ?? "Refresh runs unavailable",
        );
      }
      return {
        runs: body.runs ?? [],
        logsByRun: body.logsByRun ?? {},
        reviewItems: body.reviewItems ?? [],
      };
    },
    [adminHeaders, adminSecret],
  );

  const loadSources = useCallback(
    async (secret = adminSecret) => {
      try {
        const body = await readSources(secret);
        const refreshes = await readRefreshRuns(secret);
        setSnapshot({ owners: body.owners, targets: body.targets });
        setRefreshSnapshot(refreshes);
        setStatus("Source targets ready");
        setRequiresSecret(false);
      } catch (error) {
        if (isUnauthorized(error)) {
          setRequiresSecret(true);
        }
        throw error;
      }
    },
    [adminSecret, readRefreshRuns, readSources],
  );

  useEffect(() => {
    let active = true;

    void Promise.all([readSources(adminSecret), readRefreshRuns(adminSecret)])
      .then(([body, refreshes]) => {
        if (active) {
          setSnapshot({ owners: body.owners, targets: body.targets });
          setRefreshSnapshot(refreshes);
          setStatus("Source targets ready");
          setRequiresSecret(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          if (isUnauthorized(error)) {
            setRequiresSecret(true);
          }
          setStatus(
            error instanceof Error ? error.message : "Source targets failed",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [adminSecret, readRefreshRuns, readSources]);

  async function mutate(
    method: "DELETE" | "PATCH" | "POST",
    entity: RefreshEntity,
    input: unknown,
    id?: string,
  ) {
    const response = await fetch("/api/admin/source-targets", {
      method,
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ entity, id, input }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      if (response.status === 401) {
        setRequiresSecret(true);
      }
      throw new Error(body.error ?? "Source target mutation failed");
    }
    setStatus(`${entity} saved`);
    await loadSources();
  }

  function submit(handler: (form: FormData) => Promise<void>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await handler(form);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Source target mutation failed",
        );
      }
    };
  }

  async function remove(entity: RefreshEntity, id: string, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }
    try {
      await mutate("DELETE", entity, undefined, id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Deletion failed");
    }
  }

  async function toggleEnabled(target: SourceTargetRecord) {
    try {
      await mutate(
        "PATCH",
        "sourceTarget",
        { enabled: !target.enabled },
        target.id,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Toggle failed");
    }
  }

  async function runRefresh() {
    try {
      setStatus("Running refresh");
      const response = await fetch("/api/admin/refresh-runs?city=chicago", {
        method: "POST",
        headers: adminHeaders(),
      });
      const body = (await response.json()) as {
        run?: RefreshRunRecord;
        logs?: RefreshRunLogRecord[];
        reviewItems?: ReviewItemRecord[];
        error?: string;
      };
      if (!response.ok || !body.run) {
        if (response.status === 401) {
          setRequiresSecret(true);
        }
        throw new RefreshRequestError(
          response.status,
          body.error ?? "Refresh run failed",
        );
      }

      setRefreshSnapshot((current) => ({
        runs: [body.run!, ...current.runs.filter((run) => run.id !== body.run!.id)],
        logsByRun: {
          ...current.logsByRun,
          [body.run!.id]: body.logs ?? [],
        },
        reviewItems: [
          ...(body.reviewItems ?? []),
          ...current.reviewItems.filter((item) => item.runId !== body.run!.id),
        ],
      }));
      setStatus(`Refresh ${body.run.status}`);
      await loadSources();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh run failed");
    }
  }

  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");

  async function reviewAction(
    action: "approve" | "reject",
    itemId: string,
    extra?: { acceptedFields?: string[]; editedDraft?: Record<string, unknown>; reason?: string; notes?: string },
  ) {
    try {
      setStatus(`${action}ing review item`);
      const response = await fetch("/api/admin/review-items", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ action, id: itemId, ...extra }),
      });
      const body = (await response.json()) as {
        reviewItem?: ReviewItemRecord;
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 401) setRequiresSecret(true);
        throw new Error(body.error ?? "Review action failed");
      }
      setStatus(`Review item ${action}d`);
      await loadSources();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Review action failed");
    }
  }

  async function updateDraft(itemId: string, draft: Record<string, unknown>) {
    try {
      setStatus("Updating draft");
      const response = await fetch("/api/admin/review-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ id: itemId, input: { normalizedDraft: draft } }),
      });
      const body = (await response.json()) as {
        reviewItem?: ReviewItemRecord;
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 401) setRequiresSecret(true);
        throw new Error(body.error ?? "Draft update failed");
      }
      setStatus("Draft updated");
      await loadSources();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Draft update failed");
    }
  }

  async function unlockAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const secret = formValue(form, "adminSecret");

    setAdminSecret(secret);
    window.sessionStorage.setItem(adminSecretStorageKey, secret);
    setStatus("Checking admin secret");

    try {
      await loadSources(secret);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Admin secret failed");
    }
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
      <header className="rise border-b-2 border-rule-strong pb-7">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.24em] text-signal underline decoration-rule-strong underline-offset-4"
          >
            Back to dashboard
          </Link>
          <Link
            href="/admin"
            className="font-mono text-xs uppercase tracking-[0.24em] text-signal underline decoration-rule-strong underline-offset-4"
          >
            Admin catalog
          </Link>
        </div>
        <h1 className="mt-4 font-display text-[clamp(3rem,10vw,7rem)] uppercase leading-[0.84] text-ink">
          Source Targets
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-dim">
          Configure where Chicago refresh runs look for events. Targets are
          grouped under source owners — venues, artists, promoters, and listing
          platforms.
        </p>
      </header>

      <p
        role="alert"
        aria-label="Source targets status"
        className="mt-5 border-y border-rule py-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-dim"
      >
        {status}
      </p>

      {requiresSecret ? (
        <form
          aria-label="Unlock source targets"
          className="mt-8 max-w-xl border-b border-rule pb-6"
          onSubmit={unlockAdmin}
        >
          <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
            Admin secret
            <input
              name="adminSecret"
              required
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full border border-rule bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
            />
          </label>
          <div className="mt-4">
            <SubmitButton>Unlock admin</SubmitButton>
          </div>
        </form>
      ) : null}

      {requiresSecret ? null : (
        <main className="mt-10 grid gap-12 lg:grid-cols-[0.95fr_1.25fr]">
          <section aria-labelledby="create-heading" className="space-y-8">
            <SectionHeading title="Configure" index="Sources / 01" />

            <section aria-label="Manual refresh" className="border-b border-rule pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl uppercase leading-none text-ink">
                    Refresh Run
                  </h3>
                  <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                    {refreshSnapshot.runs[0]
                      ? `${refreshSnapshot.runs[0].status} / ${metricLine(refreshSnapshot.runs[0])}`
                      : "No runs recorded"}
                  </p>
                </div>
                <RowButton onClick={runRefresh}>Run refresh</RowButton>
              </div>
            </section>

            <form
              aria-label="Create source owner"
              className="border-b border-rule pb-6"
              onSubmit={submit((form) =>
                mutate("POST", "sourceOwner", {
                  cityId,
                  name: formValue(form, "name"),
                  slug: formValue(form, "slug"),
                  kind: formValue(form, "kind"),
                  notes: formValue(form, "notes"),
                }),
              )}
            >
              <h3 className="font-display text-2xl uppercase leading-none text-ink">
                Source Owner
              </h3>
              <FormGrid>
                <Field label="Owner name" name="name" />
                <Field label="Owner slug" name="slug" required={false} />
                <SelectField label="Kind" name="kind" options={ownerKinds} />
                <Field label="Notes" name="notes" required={false} />
              </FormGrid>
              <div className="mt-4">
                <SubmitButton>Create owner</SubmitButton>
              </div>
            </form>

            <div className="border-b border-rule pb-6">
              <h3 className="font-display text-2xl uppercase leading-none text-ink">
                Source Target
              </h3>
              {snapshot.owners.length === 0 ? (
                <p className="mt-3 text-sm text-ink-dim">
                  Create a source owner first — every target is grouped under an
                  owner.
                </p>
              ) : (
                <form
                  aria-label="Create source target"
                  className="mt-3"
                  onSubmit={submit((form) =>
                    mutate("POST", "sourceTarget", {
                      cityId,
                      ownerId: formValue(form, "ownerId"),
                      url: formValue(form, "url"),
                      sourceType: formValue(form, "sourceType"),
                      parserStrategy: formValue(form, "parserStrategy"),
                      trustLevel: formValue(form, "trustLevel"),
                      enabled: form.get("enabled") === "on",
                      confidenceAdjustment: formNumber(
                        form,
                        "confidenceAdjustment",
                      ),
                      healthStatus: "healthy",
                      refreshCadence: formValue(form, "refreshCadence"),
                      notes: formValue(form, "notes"),
                    }),
                  )}
                >
                  <FormGrid>
                    <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                      Owner
                      <select
                        name="ownerId"
                        defaultValue={snapshot.owners[0]?.id}
                        className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
                      >
                        {snapshot.owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Target URL" name="url" />
                    <SelectField
                      label="Source type"
                      name="sourceType"
                      options={sourceTypes}
                    />
                    <SelectField
                      label="Parser strategy"
                      name="parserStrategy"
                      options={parserStrategies}
                    />
                    <SelectField
                      label="Trust level"
                      name="trustLevel"
                      options={trustLevels}
                    />
                    <Field
                      label="Refresh cadence"
                      name="refreshCadence"
                      defaultValue="daily"
                      required={false}
                    />
                    <Field
                      label="Confidence adjustment"
                      name="confidenceAdjustment"
                      type="number"
                      defaultValue={0}
                      required={false}
                    />
                    <Field label="Notes" name="notes" required={false} />
                    <label className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked
                        className="accent-signal"
                      />
                      Enabled
                    </label>
                  </FormGrid>
                  <div className="mt-4">
                    <SubmitButton>Create target</SubmitButton>
                  </div>
                </form>
              )}
            </div>
          </section>

          <section aria-labelledby="lists-heading" className="space-y-10">
            <SectionHeading title="Refresh Review" index="Runs / 02" />

            <section aria-label="Refresh run history" className="border-b border-rule pb-6">
              {refreshSnapshot.runs.length === 0 ? (
                <p className="text-sm text-ink-dim">No refresh runs yet.</p>
              ) : (
                <ol>
                  {refreshSnapshot.runs.slice(0, 3).map((run) => (
                    <li key={run.id} className="border-t border-rule py-4 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                          {run.status} / {metricLine(run)}
                        </p>
                        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                          {run.finishedAt ?? run.startedAt ?? "pending"}
                        </p>
                      </div>
                      {run.errorSummary ? (
                        <p className="mt-2 text-sm text-ink-dim">{run.errorSummary}</p>
                      ) : null}
                      <ol className="mt-3 space-y-2">
                        {(refreshSnapshot.logsByRun[run.id] ?? []).map((log) => (
                          <li
                            key={log.id}
                            className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim"
                          >
                            {log.level} / {log.message}
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-label="Source health" className="border-b border-rule pb-6">
              <h3 className="font-display text-2xl uppercase leading-none text-ink">
                Source Health
              </h3>
              {(() => {
                const { coverage, approvalRate } = healthMetrics(
                  refreshSnapshot.runs,
                  refreshSnapshot.reviewItems,
                  snapshot.targets,
                );
                return (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                    <span>Last coverage: {coverage}</span>
                    <span>Approval rate: {approvalRate}</span>
                  </div>
                );
              })()}
            </section>

            <section aria-label="Review lanes" className="border-b border-rule pb-6">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                  Show:
                </span>
                {(["pending", "approved", "rejected", "all"] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReviewStatusFilter(filter)}
                      className={`border px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] transition-colors ${
                        reviewStatusFilter === filter
                          ? "border-signal text-signal"
                          : "border-rule text-ink-dim hover:text-signal"
                      }`}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {reviewLanes.map((lane) => {
                  const allLaneItems = refreshSnapshot.reviewItems.filter(
                    (item) => item.lane === lane,
                  );
                  const items =
                    reviewStatusFilter === "all"
                      ? allLaneItems
                      : allLaneItems.filter(
                          (item) => item.status === reviewStatusFilter,
                        );
                  const pendingCount = allLaneItems.filter(
                    (item) => item.status === "pending",
                  ).length;
                  return (
                    <ReviewLanePanel
                      key={lane}
                      lane={lane}
                      items={items}
                      pendingCount={pendingCount}
                      onApprove={(id, extra) =>
                        reviewAction("approve", id, extra)
                      }
                      onReject={(id, reason, notes) =>
                        reviewAction("reject", id, { reason, notes })
                      }
                      onUpdateDraft={updateDraft}
                    />
                  );
                })}
              </div>
            </section>

            <SectionHeading title="Targets by Owner" index="Review / 02" />

            {snapshot.owners.length === 0 ? (
              <p className="text-sm text-ink-dim">
                No source owners yet. Create an owner to group its targets.
              </p>
            ) : null}

            {snapshot.owners.map((owner) => {
              const targets = targetsByOwner.get(owner.id) ?? [];
              return (
                <section
                  key={owner.id}
                  aria-label={`${owner.name} source owner`}
                  className="border-b border-rule pb-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {owner.name}
                      </h3>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                        {owner.kind} / {targets.length} target
                        {targets.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <RowButton
                      onClick={() =>
                        remove("sourceOwner", owner.id, owner.name)
                      }
                    >
                      Delete owner
                    </RowButton>
                  </div>

                  <ol className="mt-3">
                    {targets.map((target) => (
                      <li
                        key={target.id}
                        aria-label={`${target.url} source target`}
                        className="border-t border-rule py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-sans text-sm text-ink">
                              {target.url}
                            </p>
                            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                              {target.parserStrategy} / {target.trustLevel} /{" "}
                              {target.healthStatus} /{" "}
                              {target.enabled ? "enabled" : "disabled"}
                            </p>
                            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                              failures {target.failureCount} / rejections{" "}
                              {target.rejectionCount} / duplicates{" "}
                              {target.duplicateCount}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <RowButton onClick={() => toggleEnabled(target)}>
                              {target.enabled ? "Disable" : "Enable"}
                            </RowButton>
                            <RowButton
                              onClick={() =>
                                remove("sourceTarget", target.id, target.url)
                              }
                            >
                              Delete
                            </RowButton>
                          </div>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                            Edit
                          </summary>
                          <form
                            aria-label={`Edit ${target.url}`}
                            className="mt-3"
                            onSubmit={submit((form) =>
                              mutate(
                                "PATCH",
                                "sourceTarget",
                                {
                                  url: formValue(form, "url"),
                                  sourceType: formValue(form, "sourceType"),
                                  parserStrategy: formValue(
                                    form,
                                    "parserStrategy",
                                  ),
                                  trustLevel: formValue(form, "trustLevel"),
                                  healthStatus: formValue(form, "healthStatus"),
                                  confidenceAdjustment: formNumber(
                                    form,
                                    "confidenceAdjustment",
                                  ),
                                  refreshCadence: formValue(
                                    form,
                                    "refreshCadence",
                                  ),
                                  notes: formValue(form, "notes"),
                                },
                                target.id,
                              ),
                            )}
                          >
                            <FormGrid>
                              <Field
                                label="Target URL"
                                name="url"
                                defaultValue={target.url}
                              />
                              <SelectField
                                label="Source type"
                                name="sourceType"
                                options={sourceTypes}
                                defaultValue={target.sourceType}
                              />
                              <SelectField
                                label="Parser strategy"
                                name="parserStrategy"
                                options={
                                  parserStrategies.includes(
                                    target.parserStrategy,
                                  )
                                    ? parserStrategies
                                    : [
                                        ...parserStrategies,
                                        target.parserStrategy,
                                      ]
                                }
                                defaultValue={target.parserStrategy}
                              />
                              <SelectField
                                label="Trust level"
                                name="trustLevel"
                                options={trustLevels}
                                defaultValue={target.trustLevel}
                              />
                              <SelectField
                                label="Health status"
                                name="healthStatus"
                                options={healthStatuses}
                                defaultValue={target.healthStatus}
                              />
                              <Field
                                label="Refresh cadence"
                                name="refreshCadence"
                                defaultValue={target.refreshCadence}
                                required={false}
                              />
                              <Field
                                label="Confidence adjustment"
                                name="confidenceAdjustment"
                                type="number"
                                defaultValue={target.confidenceAdjustment}
                                required={false}
                              />
                              <Field
                                label="Notes"
                                name="notes"
                                defaultValue={target.notes}
                                required={false}
                              />
                            </FormGrid>
                            <div className="mt-4">
                              <SubmitButton>Save changes</SubmitButton>
                            </div>
                          </form>
                        </details>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </section>
        </main>
      )}
    </div>
  );
}
