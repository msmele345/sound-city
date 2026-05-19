"use client";

import { useEffect, useMemo, useState } from "react";

import {
  defaultRecommendationActions,
  defaultTasteProfile,
  rankRecommendedEvents,
  type RecommendationActions,
  type RecommendationEvent,
  type StartTimePreference,
  type TasteProfile,
  type TasteStyle,
  type TasteVibe,
  type VenueSizePreference,
} from "@/lib/recommendations";

const manifest = [
  { value: "24", label: "Verified" },
  { value: "09", label: "Neighborhoods" },
  { value: "07", label: "Underground" },
];

const venueSignals = [
  { label: "Sound", value: "Warm stacks" },
  { label: "Crowd", value: "Heads-down" },
  { label: "Room", value: "Compact" },
  { label: "Door", value: "Low-key" },
];

const nav = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Events", href: "#events" },
  { label: "Artists", href: "#artists" },
  { label: "Venues", href: "#venues" },
  { label: "Admin" },
];

const storageKey = "sound-city.local-profile.v1";

const styleOptions: TasteStyle[] = [
  "house",
  "techno",
  "acid",
  "melodic house",
  "deep house",
];

const vibeOptions: { value: TasteVibe; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "deep", label: "Deep" },
  { value: "melodic", label: "Melodic" },
  { value: "high-energy", label: "High energy" },
];

const venueSizeOptions: { value: VenueSizePreference; label: string }[] = [
  { value: "small-room", label: "Small room" },
  { value: "midsize-club", label: "Midsize club" },
  { value: "warehouse", label: "Warehouse" },
];

const startTimeOptions: { value: StartTimePreference; label: string }[] = [
  { value: "early", label: "Early" },
  { value: "late", label: "Late" },
  { value: "after-hours", label: "After hours" },
];

type CatalogEvent = RecommendationEvent & {
  id: string;
  citySlug?: string;
  title: string;
  slug?: string;
  startsAt: string;
  venue: {
    name: string;
    neighborhood: string;
    capacity: number | null;
  };
  artists: { name: string; slug?: string }[];
  styles: string[];
  source: {
    title: string;
    url: string;
    lastVerifiedAt: string;
  };
};

type EventFeedState =
  | { status: "loading"; events: CatalogEvent[] }
  | { status: "ready"; events: CatalogEvent[] }
  | { status: "error"; events: CatalogEvent[] };

type LocalPersonalization = {
  profile: TasteProfile;
  actions: RecommendationActions;
};

function isTasteStyle(value: string): value is TasteStyle {
  return styleOptions.includes(value as TasteStyle);
}

function readLocalPersonalization(): LocalPersonalization {
  if (typeof window === "undefined") {
    return {
      profile: defaultTasteProfile,
      actions: defaultRecommendationActions,
    };
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return {
        profile: defaultTasteProfile,
        actions: defaultRecommendationActions,
      };
    }

    const parsed = JSON.parse(stored) as Partial<LocalPersonalization>;
    return {
      profile: {
        ...defaultTasteProfile,
        ...parsed.profile,
        styles:
          parsed.profile?.styles?.filter((style): style is TasteStyle =>
            isTasteStyle(style),
          ) ?? defaultTasteProfile.styles,
        discoveryLevel: Number(parsed.profile?.discoveryLevel ?? 4),
      },
      actions: {
        ...defaultRecommendationActions,
        ...parsed.actions,
      },
    };
  } catch {
    return {
      profile: defaultTasteProfile,
      actions: defaultRecommendationActions,
    };
  }
}

function formatEventDate(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(startsAt));
}

function formatEventTime(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(startsAt));
}

function MatchMeter({ score }: { score: number }) {
  const filled = Math.round(score * 10);
  const pct = Math.round(score * 100);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm">
      <span aria-hidden className="tracking-[0.05em]">
        <span className="text-signal">{"█".repeat(filled)}</span>
        <span className="text-rule-strong">{"░".repeat(10 - filled)}</span>
      </span>
      <span className="font-semibold text-signal tabular-nums">
        {score.toFixed(2)}
      </span>
      <span className="sr-only">Match {pct} percent</span>
    </span>
  );
}

function EventDiscoveryFeed({ feed }: { feed: EventFeedState }) {
  const [activeStyle, setActiveStyle] = useState("all");

  const events = useMemo(
    () =>
      feed.events.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [feed.events],
  );
  const styles = useMemo(
    () => [...new Set(events.flatMap((event) => event.styles))].toSorted(),
    [events],
  );
  const visibleEvents = useMemo(
    () =>
      activeStyle === "all"
        ? events
        : events.filter((event) => event.styles.includes(activeStyle)),
    [activeStyle, events],
  );

  if (feed.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading Chicago event feed
      </p>
    );
  }

  if (feed.status === "error") {
    return (
      <p role="alert" className="border-b border-rule py-5 text-sm text-ink-dim">
        Event feed is unavailable. Source-verified listings will return here.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No upcoming Chicago events are verified yet.
      </p>
    );
  }

  return (
    <>
      <div
        aria-label="Filter events by style"
        className="mt-4 flex flex-wrap border-y border-rule font-mono text-[0.7rem] uppercase tracking-[0.16em]"
      >
        {["all", ...styles].map((style) => (
          <button
            key={style}
            type="button"
            aria-pressed={activeStyle === style}
            onClick={() => setActiveStyle(style)}
            className={`border-r border-rule px-3 py-2 transition-colors duration-150 hover:bg-panel hover:text-signal ${
              activeStyle === style ? "bg-panel text-signal" : "text-ink-dim"
            }`}
          >
            {style}
          </button>
        ))}
      </div>
      {visibleEvents.length === 0 ? (
        <p className="border-b border-rule py-5 text-sm text-ink-dim">
          No verified events match that style.
        </p>
      ) : (
        <ol className="mt-1">
          {visibleEvents.map((event, i) => (
            <li
              key={event.id}
              className="grid gap-4 border-b border-rule py-5 sm:grid-cols-[5.5rem_1fr] sm:gap-6"
            >
              <div className="font-mono uppercase text-ink-faint">
                <p className="text-xs tracking-[0.18em]">
                  {formatEventDate(event.startsAt)}
                </p>
                <p className="mt-1 text-sm tracking-[0.08em] text-ink">
                  {formatEventTime(event.startsAt)}
                </p>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink">
                    {event.title}
                  </h3>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-dim">
                  {event.venue.name}
                  <span className="text-ink-faint"> / </span>
                  {event.venue.neighborhood}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                  {event.artists.map((artist) => artist.name).join(", ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                  <span className="text-ink-faint">
                    {event.styles.join(" / ")}
                  </span>
                  <span className="text-ink-faint">
                    Verified {event.source.lastVerifiedAt}
                  </span>
                  <a
                    href={event.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
                  >
                    {event.source.title}
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function TasteProfileControls({
  profile,
  onProfileChange,
}: {
  profile: TasteProfile;
  onProfileChange(profile: TasteProfile): void;
}) {
  function toggleStyle(style: TasteStyle) {
    const styles = profile.styles.includes(style)
      ? profile.styles.filter((current) => current !== style)
      : [...profile.styles, style];
    onProfileChange({
      ...profile,
      styles: styles.length > 0 ? styles : [style],
    });
  }

  return (
    <div className="mt-5 border-y border-rule py-4">
      <fieldset>
        <legend className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
          Styles
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {styleOptions.map((style) => (
            <label
              key={style}
              className={`inline-flex cursor-pointer items-center gap-2 border border-rule px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors duration-150 ${
                profile.styles.includes(style)
                  ? "bg-panel text-signal"
                  : "text-ink-dim hover:bg-panel"
              }`}
            >
              <input
                type="checkbox"
                checked={profile.styles.includes(style)}
                onChange={() => toggleStyle(style)}
                className="size-3 accent-signal"
              />
              {style}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Vibe
          <select
            value={profile.vibe}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                vibe: event.target.value as TasteVibe,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {vibeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Venue size
          <select
            value={profile.venueSize}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                venueSize: event.target.value as VenueSizePreference,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {venueSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Start time
          <select
            value={profile.startTime}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                startTime: event.target.value as StartTimePreference,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {startTimeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
        Discovery level
        <input
          type="range"
          min="1"
          max="5"
          value={profile.discoveryLevel}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              discoveryLevel: Number(event.target.value),
            })
          }
          className="mt-2 w-full accent-signal"
        />
      </label>
    </div>
  );
}

function updateIds(ids: string[], id: string, mode: "add" | "remove") {
  const next = new Set(ids);
  if (mode === "add") {
    next.add(id);
  } else {
    next.delete(id);
  }
  return [...next];
}

function RecommendedEvents({
  feed,
  profile,
  actions,
  onProfileChange,
  onActionsChange,
}: {
  feed: EventFeedState;
  profile: TasteProfile;
  actions: RecommendationActions;
  onProfileChange(profile: TasteProfile): void;
  onActionsChange(actions: RecommendationActions): void;
}) {
  const recommendations = useMemo(
    () => rankRecommendedEvents(feed.events, { profile, actions }).slice(0, 5),
    [actions, feed.events, profile],
  );

  function saveEvent(id: string) {
    const isSaved = actions.savedEventIds.includes(id);
    onActionsChange({
      ...actions,
      savedEventIds: updateIds(
        actions.savedEventIds,
        id,
        isSaved ? "remove" : "add",
      ),
    });
  }

  function dismissEvent(id: string) {
    onActionsChange({
      ...actions,
      savedEventIds: updateIds(actions.savedEventIds, id, "remove"),
      dismissedEventIds: updateIds(actions.dismissedEventIds, id, "add"),
    });
  }

  function attendEvent(id: string) {
    onActionsChange({
      ...actions,
      savedEventIds: updateIds(actions.savedEventIds, id, "remove"),
      attendedEventIds: updateIds(actions.attendedEventIds, id, "add"),
    });
  }

  return (
    <>
      <TasteProfileControls
        profile={profile}
        onProfileChange={onProfileChange}
      />

      {feed.status === "loading" ? (
        <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
          Loading recommendation queue
        </p>
      ) : feed.status === "error" ? (
        <p className="border-b border-rule py-5 text-sm text-ink-dim">
          Recommendation queue is unavailable until the event feed returns.
        </p>
      ) : recommendations.length === 0 ? (
        <p className="border-b border-rule py-5 text-sm text-ink-dim">
          No recommendations remain in the local queue.
        </p>
      ) : (
        <ol className="mt-1">
          {recommendations.map((item, i) => (
            <li
              key={item.event.id}
              className="rise group grid grid-cols-[auto_1fr] gap-x-5 border-b border-rule py-6 transition-colors duration-150 hover:bg-panel/60 sm:gap-x-8"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <span className="font-display text-4xl leading-none text-ink-faint transition-colors duration-150 group-hover:text-signal sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl">
                    {item.event.title}
                  </h3>
                  <p className="font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
                    {formatEventDate(item.event.startsAt)}
                    <span className="text-ink-faint"> &middot; </span>
                    {formatEventTime(item.event.startsAt)}
                  </p>
                </div>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-dim">
                  {item.event.venue.name}
                  <span className="text-ink-faint"> / </span>
                  {item.event.venue.neighborhood}
                </p>
                <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-dim">
                  {item.reason}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <MatchMeter score={item.score} />
                  <button
                    type="button"
                    aria-pressed={item.saved}
                    onClick={() => saveEvent(item.event.id)}
                    className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal"
                  >
                    {item.saved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissEvent(item.event.id)}
                    className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => attendEvent(item.event.id)}
                    className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal"
                  >
                    Mark attended
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// Spec-sheet section marker: heading + a mono index tag sharing one strong rule.
// The tag is metadata (queue / index), not a restatement of the heading.
function SectionMark({
  id,
  title,
  index,
}: {
  id: string;
  title: string;
  index: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-rule-strong pb-2">
      <h2
        id={id}
        className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl"
      >
        {title}
      </h2>
      <span className="shrink-0 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        {index}
      </span>
    </div>
  );
}

export function DashboardShell() {
  const [feed, setFeed] = useState<EventFeedState>({
    status: "loading",
    events: [],
  });
  const [personalization, setPersonalization] = useState<LocalPersonalization>(
    () => readLocalPersonalization(),
  );

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      try {
        const response = await fetch("/api/catalog/events?city=chicago");
        if (!response.ok) {
          throw new Error("Event feed unavailable");
        }
        const body = (await response.json()) as { events: CatalogEvent[] };
        if (active) {
          setFeed({ status: "ready", events: body.events });
        }
      } catch {
        if (active) {
          setFeed({ status: "error", events: [] });
        }
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(personalization));
  }, [personalization]);

  return (
    <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
      <header id="dashboard" className="rise scroll-mt-6 border-b-2 border-rule-strong pb-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-signal">
              Chicago / House + Techno
            </p>
            <h1 className="mt-3 font-display text-[clamp(3.5rem,13vw,8.5rem)] uppercase leading-[0.82] tracking-[0.005em] text-ink">
              Sound City
            </h1>
          </div>
          <div className="shrink-0 lg:text-right">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-faint">
              CHI&middot;HT / VOL.01
            </p>
            <dl className="mt-3 flex gap-6 lg:justify-end">
              {manifest.map((item) => (
                <div key={item.label}>
                  <dd className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    {item.value}
                  </dd>
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {/* Hazard-tape mark — one deliberate brand stripe, not decoration. */}
        <div
          aria-hidden
          className="mt-6 h-2"
          style={{
            background:
              "repeating-linear-gradient(135deg, var(--color-signal) 0 14px, transparent 14px 28px)",
          }}
        />
      </header>

      <nav
        aria-label="Primary navigation"
        className="rise mt-6 flex flex-wrap items-stretch border-b border-rule font-mono text-xs uppercase tracking-[0.2em]"
        style={{ animationDelay: "70ms" }}
      >
        {nav.map((item, i) => (
          <a
            key={item.label}
            href={item.href}
            aria-disabled={item.href ? undefined : "true"}
            aria-current={i === 0 ? "page" : undefined}
            className={`border-r border-rule px-4 py-3 transition-colors duration-150 hover:bg-panel hover:text-signal ${
              i === 0
                ? "bg-panel text-signal"
                : item.href
                  ? "text-ink-dim"
                  : "cursor-not-allowed text-ink-faint"
            }`}
          >
            <span className="text-ink-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
            {item.label}
          </a>
        ))}
      </nav>

      <main className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-[1.65fr_0.7fr]">
        <div className="flex flex-col gap-12">
          <section
            id="recommendations"
            aria-labelledby="recommended-heading"
            className="scroll-mt-6"
          >
            <SectionMark
              id="recommended-heading"
              title="Recommended Tonight"
              index="Discovery queue / 02"
            />
            <RecommendedEvents
              feed={feed}
              profile={personalization.profile}
              actions={personalization.actions}
              onProfileChange={(profile) =>
                setPersonalization((current) => ({ ...current, profile }))
              }
              onActionsChange={(actions) =>
                setPersonalization((current) => ({ ...current, actions }))
              }
            />
          </section>

          <section id="events" aria-labelledby="latest-heading" className="scroll-mt-6">
            <SectionMark
              id="latest-heading"
              title="Latest Events"
              index="Source verified / 03"
            />
            <EventDiscoveryFeed feed={feed} />
          </section>
        </div>

        <aside className="flex flex-col gap-12 lg:border-l-2 lg:border-rule-strong lg:pl-12">
          <section id="artists" aria-labelledby="showcase-heading" className="scroll-mt-6">
            <SectionMark
              id="showcase-heading"
              title="Artist Showcase"
              index="Feature / 04"
            />
            <div className="mt-5 border border-rule-strong bg-panel">
              <div
                aria-hidden
                className="h-1.5"
                style={{
                  background:
                    "repeating-linear-gradient(135deg, var(--color-signal) 0 10px, transparent 10px 20px)",
                }}
              />
              <div className="p-5">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-signal">
                  Archive week
                </p>
                <p className="mt-3 font-display text-5xl uppercase leading-[0.85] text-ink">
                  DJ
                  <br />
                  Heather
                </p>
                <p className="mt-5 text-sm leading-relaxed text-ink-dim">
                  Weekly deep-dive into one Chicago-rooted selector — archive
                  sets, where to listen, upcoming dates.
                </p>
                <p className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-signal">
                  Listening links
                  <span aria-hidden>&rarr;</span>
                </p>
              </div>
            </div>
          </section>

          <section id="venues" aria-labelledby="venue-heading" className="scroll-mt-6">
            <SectionMark
              id="venue-heading"
              title="Venue Signals"
              index="Room context / 05"
            />
            <dl className="mt-1">
              {venueSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="flex items-baseline gap-2 border-b border-rule py-3.5 font-mono text-sm"
                >
                  <dt className="uppercase tracking-[0.16em] text-ink-faint">
                    {signal.label}
                  </dt>
                  <span
                    aria-hidden
                    className="mb-1 flex-1 self-end border-b border-dotted border-rule-strong"
                  />
                  <dd className="uppercase tracking-[0.06em] text-ink">
                    {signal.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </main>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
        <span>Source-verified &middot; Chicago underground</span>
        <span>End of manifest</span>
      </footer>
    </div>
  );
}
