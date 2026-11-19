"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatEventDate, formatEventTime } from "./format";
import { SectionMark } from "./section-mark";
import type { EventFeedState } from "./types";

export function NextUp({ feed }: { feed: EventFeedState }) {
  const events = useMemo(
    () =>
      feed.events.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5),
    [feed.events],
  );

  return (
    <section
      id="next-up"
      aria-labelledby="next-up-heading"
      className="min-w-0 scroll-mt-6"
    >
      <SectionMark id="next-up-heading" title="Next up" index="Feed / 03" />
      {feed.status === "loading" ? (
        <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
          Loading next events
        </p>
      ) : feed.status === "error" ? (
        <p role="alert" className="border-b border-rule py-5 text-sm text-ink-dim">
          Event feed is unavailable. Source-verified listings will return here.
        </p>
      ) : events.length === 0 ? (
        <p className="border-b border-rule py-5 text-sm text-ink-dim">
          No upcoming Chicago events are verified yet.
        </p>
      ) : (
        <ol className="mt-1">
          {events.map((event) => (
            <li key={event.id} className="border-b border-rule py-4">
              <h3 className="font-display text-2xl uppercase leading-none text-ink">
                {event.title}
              </h3>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-dim">
                {formatEventDate(event.startsAt)}
                <span className="text-ink-faint"> / </span>
                {formatEventTime(event.startsAt)}
                <span className="text-ink-faint"> / </span>
                {event.venue.name}
                <span className="text-ink-faint"> / </span>
                {event.venue.neighborhood}
              </p>
            </li>
          ))}
        </ol>
      )}
      <Link
        href="/events"
        className="mt-4 inline-flex font-mono text-xs uppercase tracking-[0.16em] text-signal transition-colors duration-150 hover:text-ink"
      >
        All events
      </Link>
    </section>
  );
}
