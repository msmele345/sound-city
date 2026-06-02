"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type SourceRecord = {
  id?: string;
  title: string;
  url: string;
  lastVerifiedAt: string;
};

type VenueSignalRecord = {
  id: string;
  venueSlug: string;
  category: "sound" | "crowd" | "room" | "door" | "layout";
  value: string;
  source: SourceRecord;
};

type VenueRecord = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  neighborhood: string;
  address: string;
  capacity: number | null;
  source: SourceRecord;
  signals: VenueSignalRecord[];
};

type ArtistLinkRecord = {
  id: string;
  artistSlug: string;
  kind: "official" | "soundcloud" | "bandcamp" | "youtube" | "resident-advisor";
  label: string;
  url: string;
  source: SourceRecord;
};

type ArtistRecord = {
  id: string;
  citySlug: string;
  name: string;
  slug: string;
  bio: string;
  styles: string[];
  showcase: boolean;
  source: SourceRecord;
  links: ArtistLinkRecord[];
};

type EventRecord = {
  id: string;
  citySlug: string;
  title: string;
  slug: string;
  startsAt: string;
  venue: Pick<VenueRecord, "name" | "neighborhood" | "slug">;
  artists: Pick<ArtistRecord, "name" | "slug">[];
  styles: string[];
  source: SourceRecord;
};

type AdminSnapshot = {
  venues: VenueRecord[];
  artists: ArtistRecord[];
  events: EventRecord[];
  sources: SourceRecord[];
};

type AdminEntity = "artist" | "artistLink" | "event" | "venue" | "venueSignal";

const linkKinds: ArtistLinkRecord["kind"][] = [
  "official",
  "soundcloud",
  "bandcamp",
  "youtube",
  "resident-advisor",
];

const signalCategories: VenueSignalRecord["category"][] = [
  "sound",
  "crowd",
  "room",
  "door",
  "layout",
];

const adminSecretHeader = "x-sound-city-admin-secret";
const adminSecretStorageKey = "sound-city.admin-secret.v1";

class AdminCatalogRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isUnauthorizedAdminError(error: unknown) {
  return error instanceof AdminCatalogRequestError && error.status === 401;
}

function csv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isoInputValue(value: string) {
  return value.slice(0, 16);
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

function TextAreaField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        className="mt-2 min-h-24 w-full border border-rule bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
      />
    </label>
  );
}

function SourceFields({ source }: { source?: SourceRecord }) {
  return (
    <>
      <Field label="Source title" name="sourceTitle" defaultValue={source?.title} />
      <Field label="Source URL" name="sourceUrl" defaultValue={source?.url} />
      <Field
        label="Last verified"
        name="sourceLastVerifiedAt"
        defaultValue={source?.lastVerifiedAt}
        type="date"
      />
    </>
  );
}

function sourceFromForm(form: FormData) {
  return {
    title: String(form.get("sourceTitle") ?? ""),
    url: String(form.get("sourceUrl") ?? ""),
    lastVerifiedAt: String(form.get("sourceLastVerifiedAt") ?? ""),
  };
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

function formNumber(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? Number(value) : null;
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

function DeleteButton({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal"
    >
      Delete
    </button>
  );
}

function SectionHeading({
  title,
  index,
}: {
  title: string;
  index: string;
}) {
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

export function AdminCatalog() {
  const [adminSecret, setAdminSecret] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.sessionStorage.getItem(adminSecretStorageKey) ?? "";
  });
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminSnapshot>({
    venues: [],
    artists: [],
    events: [],
    sources: [],
  });
  const [status, setStatus] = useState("Loading admin catalog");

  const artistLinks = useMemo(
    () => snapshot.artists.flatMap((artist) => artist.links),
    [snapshot.artists],
  );
  const venueSignals = useMemo(
    () => snapshot.venues.flatMap((venue) => venue.signals),
    [snapshot.venues],
  );

  const adminHeaders = useCallback((secret = adminSecret): HeadersInit => {
    return secret ? { [adminSecretHeader]: secret } : {};
  }, [adminSecret]);

  const readCatalog = useCallback(async (secret = adminSecret) => {
    const response = await fetch("/api/admin/catalog?city=chicago", {
      headers: adminHeaders(secret),
    });
    const body = (await response.json()) as AdminSnapshot & { error?: string };
    if (!response.ok) {
      throw new AdminCatalogRequestError(
        response.status,
        body.error ?? "Admin catalog unavailable",
      );
    }
    return body;
  }, [adminHeaders, adminSecret]);

  const loadCatalog = useCallback(async (secret = adminSecret) => {
    try {
      const body = await readCatalog(secret);
      setSnapshot(body);
      setStatus("Admin catalog ready");
      setRequiresSecret(false);
    } catch (error) {
      if (isUnauthorizedAdminError(error)) {
        setRequiresSecret(true);
      }
      throw error;
    }
  }, [adminSecret, readCatalog]);

  useEffect(() => {
    let active = true;

    void readCatalog(adminSecret)
      .then((body) => {
        if (active) {
          setSnapshot(body);
          setStatus("Admin catalog ready");
          setRequiresSecret(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          if (isUnauthorizedAdminError(error)) {
            setRequiresSecret(true);
          }
          setStatus(
            error instanceof Error ? error.message : "Admin catalog failed",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [adminSecret, readCatalog]);

  async function mutate(
    method: "DELETE" | "PATCH" | "POST",
    entity: AdminEntity,
    input: unknown,
    id?: string,
  ) {
    const response = await fetch("/api/admin/catalog", {
      method,
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ entity, id, input }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      if (response.status === 401) {
        setRequiresSecret(true);
      }
      throw new Error(body.error ?? "Admin mutation failed");
    }
    setStatus(`${entity} saved`);
    await loadCatalog();
  }

  function submit(handler: (form: FormData) => Promise<void>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await handler(form);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Admin mutation failed");
      }
    };
  }

  async function remove(entity: AdminEntity, id: string, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }
    try {
      await mutate("DELETE", entity, undefined, id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Admin deletion failed");
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
      await loadCatalog(secret);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Admin secret failed");
    }
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
      <header className="rise border-b-2 border-rule-strong pb-7">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.24em] text-signal underline decoration-rule-strong underline-offset-4"
        >
          Back to dashboard
        </Link>
        <h1 className="mt-4 font-display text-[clamp(3rem,10vw,7rem)] uppercase leading-[0.84] text-ink">
          Admin Catalog
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-dim">
          Controlled maintainer tools for Chicago launch data. Source fields
          are required so preview deployments stay reviewable.
        </p>
      </header>

      <p
        role="alert"
        aria-label="Admin status"
        className="mt-5 border-y border-rule py-3 font-mono text-xs uppercase tracking-[0.16em] text-ink-dim"
      >
        {status}
      </p>

      {requiresSecret ? (
        <form
          aria-label="Unlock admin catalog"
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
          <SectionHeading title="Create Records" index="Mutations / 01" />

          <form
            aria-label="Create venue"
            className="border-b border-rule pb-6"
            onSubmit={submit((form) =>
              mutate("POST", "venue", {
                citySlug: "chicago",
                name: formValue(form, "name"),
                slug: formValue(form, "slug"),
                neighborhood: formValue(form, "neighborhood"),
                address: formValue(form, "address"),
                capacity: formNumber(form, "capacity"),
                source: sourceFromForm(form),
              }),
            )}
          >
            <h3 className="font-display text-2xl uppercase leading-none text-ink">
              Venue
            </h3>
            <FormGrid>
              <Field label="Venue name" name="name" />
              <Field label="Venue slug" name="slug" />
              <Field label="Neighborhood" name="neighborhood" />
              <Field label="Address" name="address" />
              <Field label="Capacity" name="capacity" type="number" />
              <SourceFields />
            </FormGrid>
            <div className="mt-4">
              <SubmitButton>Create</SubmitButton>
            </div>
          </form>

          <form
            aria-label="Create artist"
            className="border-b border-rule pb-6"
            onSubmit={submit((form) =>
              mutate("POST", "artist", {
                citySlug: "chicago",
                name: formValue(form, "name"),
                slug: formValue(form, "slug"),
                styles: csv(formValue(form, "styles")),
                bio: formValue(form, "bio"),
                showcase: form.get("showcase") === "on",
                source: sourceFromForm(form),
              }),
            )}
          >
            <h3 className="font-display text-2xl uppercase leading-none text-ink">
              Artist
            </h3>
            <FormGrid>
              <Field label="Artist name" name="name" />
              <Field label="Artist slug" name="slug" />
              <Field label="Styles" name="styles" />
              <TextAreaField label="Bio" name="bio" />
              <label className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                <input name="showcase" type="checkbox" className="accent-signal" />
                Showcase artist
              </label>
              <SourceFields />
            </FormGrid>
            <div className="mt-4">
              <SubmitButton>Create</SubmitButton>
            </div>
          </form>

          <form
            aria-label="Create event"
            className="border-b border-rule pb-6"
            onSubmit={submit((form) =>
              mutate("POST", "event", {
                citySlug: "chicago",
                title: formValue(form, "title"),
                slug: formValue(form, "slug"),
                startsAt: formValue(form, "startsAt"),
                venueSlug: formValue(form, "venueSlug"),
                artistSlugs: csv(formValue(form, "artistSlugs")),
                styles: csv(formValue(form, "styles")),
                source: sourceFromForm(form),
              }),
            )}
          >
            <h3 className="font-display text-2xl uppercase leading-none text-ink">
              Event
            </h3>
            <FormGrid>
              <Field label="Event title" name="title" />
              <Field label="Event slug" name="slug" />
              <Field label="Starts at" name="startsAt" type="datetime-local" />
              <Field label="Venue slug" name="venueSlug" />
              <Field label="Artist slugs" name="artistSlugs" />
              <Field label="Styles" name="styles" />
              <SourceFields />
            </FormGrid>
            <div className="mt-4">
              <SubmitButton>Create</SubmitButton>
            </div>
          </form>

          <form
            aria-label="Create artist link"
            className="border-b border-rule pb-6"
            onSubmit={submit((form) =>
              mutate("POST", "artistLink", {
                artistSlug: formValue(form, "artistSlug"),
                kind: formValue(form, "kind"),
                label: formValue(form, "label"),
                url: formValue(form, "url"),
                source: sourceFromForm(form),
              }),
            )}
          >
            <h3 className="font-display text-2xl uppercase leading-none text-ink">
              Artist Link
            </h3>
            <FormGrid>
              <Field
                label="Artist slug"
                name="artistSlug"
                defaultValue={snapshot.artists[0]?.slug}
              />
              <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                Kind
                <select
                  name="kind"
                  className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
                >
                  {linkKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Label" name="label" />
              <Field label="Link URL" name="url" />
              <SourceFields />
            </FormGrid>
            <div className="mt-4">
              <SubmitButton>Create</SubmitButton>
            </div>
          </form>

          <form
            aria-label="Create venue signal"
            className="border-b border-rule pb-6"
            onSubmit={submit((form) =>
              mutate("POST", "venueSignal", {
                venueSlug: formValue(form, "venueSlug"),
                category: formValue(form, "category"),
                value: formValue(form, "value"),
                source: sourceFromForm(form),
              }),
            )}
          >
            <h3 className="font-display text-2xl uppercase leading-none text-ink">
              Venue Signal
            </h3>
            <FormGrid>
              <Field
                label="Venue slug"
                name="venueSlug"
                defaultValue={snapshot.venues[0]?.slug}
              />
              <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                Category
                <select
                  name="category"
                  className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
                >
                  {signalCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <TextAreaField label="Value" name="value" />
              <SourceFields />
            </FormGrid>
            <div className="mt-4">
              <SubmitButton>Create</SubmitButton>
            </div>
          </form>
        </section>

        <section aria-labelledby="lists-heading" className="space-y-10">
          <SectionHeading title="Catalog Lists" index="Review / 02" />

          <section aria-labelledby="venues-heading">
            <h2
              id="venues-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Venues
            </h2>
            <ol className="mt-2">
              {snapshot.venues.map((venue) => (
                <li
                  key={venue.id}
                  aria-label={`${venue.name} venue record`}
                  className="border-b border-rule py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {venue.name}
                      </h3>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                        {venue.neighborhood} / {venue.capacity ?? "unknown"} cap
                      </p>
                    </div>
                    <DeleteButton
                      onClick={() => remove("venue", venue.id, venue.name)}
                    />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                      Edit
                    </summary>
                    <form
                      aria-label={`Edit ${venue.name}`}
                      className="mt-3"
                      onSubmit={submit((form) =>
                        mutate(
                          "PATCH",
                          "venue",
                          {
                            name: formValue(form, "name"),
                            neighborhood: formValue(form, "neighborhood"),
                            address: formValue(form, "address"),
                            capacity: formNumber(form, "capacity"),
                            source: sourceFromForm(form),
                          },
                          venue.id,
                        ),
                      )}
                    >
                      <FormGrid>
                        <Field label="Venue name" name="name" defaultValue={venue.name} />
                        <Field
                          label="Neighborhood"
                          name="neighborhood"
                          defaultValue={venue.neighborhood}
                        />
                        <Field label="Address" name="address" defaultValue={venue.address} />
                        <Field
                          label="Capacity"
                          name="capacity"
                          type="number"
                          defaultValue={venue.capacity ?? undefined}
                        />
                        <SourceFields source={venue.source} />
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

          <section aria-labelledby="artists-heading">
            <h2
              id="artists-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Artists
            </h2>
            <ol className="mt-2">
              {snapshot.artists.map((artist) => (
                <li
                  key={artist.id}
                  aria-label={`${artist.name} artist record`}
                  className="border-b border-rule py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {artist.name}
                      </h3>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                        {artist.styles.join(" / ")}
                        {artist.showcase ? " / showcase" : ""}
                      </p>
                    </div>
                    <DeleteButton
                      onClick={() => remove("artist", artist.id, artist.name)}
                    />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                      Edit
                    </summary>
                    <form
                      aria-label={`Edit ${artist.name}`}
                      className="mt-3"
                      onSubmit={submit((form) =>
                        mutate(
                          "PATCH",
                          "artist",
                          {
                            name: formValue(form, "name"),
                            styles: csv(formValue(form, "styles")),
                            bio: formValue(form, "bio"),
                            showcase: form.get("showcase") === "on",
                            source: sourceFromForm(form),
                          },
                          artist.id,
                        ),
                      )}
                    >
                      <FormGrid>
                        <Field label="Artist name" name="name" defaultValue={artist.name} />
                        <Field
                          label="Styles"
                          name="styles"
                          defaultValue={artist.styles.join(", ")}
                        />
                        <TextAreaField label="Bio" name="bio" defaultValue={artist.bio} />
                        <label className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                          <input
                            name="showcase"
                            type="checkbox"
                            defaultChecked={artist.showcase}
                            className="accent-signal"
                          />
                          Showcase artist
                        </label>
                        <SourceFields source={artist.source} />
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

          <section aria-labelledby="events-heading">
            <h2
              id="events-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Events
            </h2>
            <ol className="mt-2">
              {snapshot.events.map((event) => (
                <li
                  key={event.id}
                  aria-label={`${event.title} event record`}
                  className="border-b border-rule py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {event.title}
                      </h3>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                        {event.venue.name} / {event.artists.map((artist) => artist.name).join(", ")}
                      </p>
                    </div>
                    <DeleteButton
                      onClick={() => remove("event", event.id, event.title)}
                    />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                      Edit
                    </summary>
                    <form
                      aria-label={`Edit ${event.title}`}
                      className="mt-3"
                      onSubmit={submit((form) =>
                        mutate(
                          "PATCH",
                          "event",
                          {
                            title: formValue(form, "title"),
                            startsAt: formValue(form, "startsAt"),
                            venueSlug: formValue(form, "venueSlug"),
                            artistSlugs: csv(formValue(form, "artistSlugs")),
                            styles: csv(formValue(form, "styles")),
                            source: sourceFromForm(form),
                          },
                          event.id,
                        ),
                      )}
                    >
                      <FormGrid>
                        <Field label="Event title" name="title" defaultValue={event.title} />
                        <Field
                          label="Starts at"
                          name="startsAt"
                          type="datetime-local"
                          defaultValue={isoInputValue(event.startsAt)}
                        />
                        <Field
                          label="Venue slug"
                          name="venueSlug"
                          defaultValue={event.venue.slug}
                        />
                        <Field
                          label="Artist slugs"
                          name="artistSlugs"
                          defaultValue={event.artists
                            .map((artist) => artist.slug)
                            .join(", ")}
                        />
                        <Field
                          label="Styles"
                          name="styles"
                          defaultValue={event.styles.join(", ")}
                        />
                        <SourceFields source={event.source} />
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

          <section aria-labelledby="links-heading">
            <h2
              id="links-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Artist Links
            </h2>
            <ol className="mt-2">
              {artistLinks.map((link) => (
                <li
                  key={link.id}
                  aria-label={`${link.label} artist link record`}
                  className="border-b border-rule py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {link.label}
                      </h3>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                        {link.artistSlug} / {link.kind}
                      </p>
                    </div>
                    <DeleteButton
                      onClick={() => remove("artistLink", link.id, link.label)}
                    />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                      Edit
                    </summary>
                    <form
                      aria-label={`Edit ${link.label}`}
                      className="mt-3"
                      onSubmit={submit((form) =>
                        mutate(
                          "PATCH",
                          "artistLink",
                          {
                            kind: formValue(form, "kind"),
                            label: formValue(form, "label"),
                            url: formValue(form, "url"),
                            source: sourceFromForm(form),
                          },
                          link.id,
                        ),
                      )}
                    >
                      <FormGrid>
                        <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                          Kind
                          <select
                            name="kind"
                            defaultValue={link.kind}
                            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
                          >
                            {linkKinds.map((kind) => (
                              <option key={kind} value={kind}>
                                {kind}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Field label="Label" name="label" defaultValue={link.label} />
                        <Field label="Link URL" name="url" defaultValue={link.url} />
                        <SourceFields source={link.source} />
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

          <section aria-labelledby="signals-heading">
            <h2
              id="signals-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Venue Signals
            </h2>
            <ol className="mt-2">
              {venueSignals.map((signal) => (
                <li
                  key={signal.id}
                  aria-label={`${signal.category} venue signal record`}
                  className="border-b border-rule py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl uppercase text-ink">
                        {signal.category}
                      </h3>
                      <p className="text-sm text-ink-dim">{signal.value}</p>
                    </div>
                    <DeleteButton
                      onClick={() =>
                        remove("venueSignal", signal.id, `${signal.category} signal`)
                      }
                    />
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">
                      Edit
                    </summary>
                    <form
                      aria-label={`Edit ${signal.category} signal`}
                      className="mt-3"
                      onSubmit={submit((form) =>
                        mutate(
                          "PATCH",
                          "venueSignal",
                          {
                            category: formValue(form, "category"),
                            value: formValue(form, "value"),
                            source: sourceFromForm(form),
                          },
                          signal.id,
                        ),
                      )}
                    >
                      <FormGrid>
                        <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                          Category
                          <select
                            name="category"
                            defaultValue={signal.category}
                            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-sm text-ink"
                          >
                            {signalCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <TextAreaField
                          label="Value"
                          name="value"
                          defaultValue={signal.value}
                        />
                        <SourceFields source={signal.source} />
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

          <section aria-labelledby="sources-heading">
            <h2
              id="sources-heading"
              className="font-display text-2xl uppercase leading-none text-ink"
            >
              Source Provenance
            </h2>
            <ol className="mt-2">
              {snapshot.sources.map((source, index) => (
                <li key={`${source.url}-${index}`} className="border-b border-rule py-4">
                  <h3 className="font-display text-xl uppercase text-ink">
                    {source.title}
                  </h3>
                  <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                    Verified {source.lastVerifiedAt}
                  </p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal underline decoration-rule-strong underline-offset-4"
                  >
                    Source URL
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </main>
      )}
    </div>
  );
}
