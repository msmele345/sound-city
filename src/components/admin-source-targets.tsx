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
  refreshCadence: string;
  lastFetchedAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  notes: string;
};

type RefreshSnapshot = {
  owners: SourceOwnerRecord[];
  targets: SourceTargetRecord[];
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
  const [snapshot, setSnapshot] = useState<RefreshSnapshot>({
    owners: [],
    targets: [],
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
      const body = (await response.json()) as RefreshSnapshot & {
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

  const loadSources = useCallback(
    async (secret = adminSecret) => {
      try {
        const body = await readSources(secret);
        setSnapshot({ owners: body.owners, targets: body.targets });
        setStatus("Source targets ready");
        setRequiresSecret(false);
      } catch (error) {
        if (isUnauthorized(error)) {
          setRequiresSecret(true);
        }
        throw error;
      }
    },
    [adminSecret, readSources],
  );

  useEffect(() => {
    let active = true;

    void readSources(adminSecret)
      .then((body) => {
        if (active) {
          setSnapshot({ owners: body.owners, targets: body.targets });
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
  }, [adminSecret, readSources]);

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
