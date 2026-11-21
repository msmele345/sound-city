"use client";

import { useMemo, useState } from "react";

import { compareStartsAt } from "@/lib/starts-at";

import { Button } from "./button";
import { EventRow } from "./event-row";
import { formatSignalCategory } from "./format";
import type { CatalogEvent, EventFeedState, VenueDirectoryState } from "./types";

function VenueUpcoming({
  events,
  feedStatus,
}: {
  events: CatalogEvent[];
  feedStatus: EventFeedState["status"];
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => events.toSorted((a, b) => compareStartsAt(a.startsAt, b.startsAt)),
    [events],
  );
  const next = sorted[0];
  const rest = sorted.slice(1);

  return (
    <div className="mt-4 border-t border-rule pt-4">
      <h4 className="font-mono text-label uppercase tracking-[0.18em] text-ink-faint">
        Upcoming events
      </h4>
      {feedStatus === "loading" ? (
        <p className="mt-3 text-body text-ink-dim">
          Waiting on verified event feed.
        </p>
      ) : !next ? (
        <p className="mt-3 text-body text-ink-dim">
          No upcoming events are attached to this venue yet.
        </p>
      ) : (
        <>
          <p className="mt-3 font-mono text-meta uppercase tracking-[0.14em] text-ink-dim">
            {sorted.length} upcoming
          </p>
          <ol className="mt-2">
            <EventRow event={next} variant="compact" compact="venue" />
            {open
              ? rest.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    variant="compact"
                    compact="venue"
                  />
                ))
              : null}
          </ol>
          {rest.length > 0 ? (
            <Button
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? "Hide the rest" : `Show ${rest.length} more`}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function VenueDirectory({
  directory,
  feed,
}: {
  directory: VenueDirectoryState;
  feed: EventFeedState;
}) {
  if (directory.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-label uppercase tracking-[0.12em] text-ink-dim">
        Loading venue directory
      </p>
    );
  }

  if (directory.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
        Venue signals are unavailable. Curated room context will return here.
      </p>
    );
  }

  if (directory.venues.length === 0) {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
        No Chicago venues are verified yet.
      </p>
    );
  }

  return (
    <ol className="mt-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-8">
      {directory.venues.map((venue, i) => {
        const upcomingEvents =
          feed.status === "ready"
            ? feed.events.filter(
                (event) =>
                  event.venue.slug === venue.slug ||
                  event.venue.name === venue.name,
              )
            : [];

        return (
          <li key={venue.id} className="border-b border-rule py-5 lg:border lg:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-3xl uppercase leading-none text-ink">
                {venue.name}
              </h3>
              <span className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 font-mono text-meta uppercase tracking-[0.13em] text-ink-faint">
              {venue.neighborhood}
              {venue.capacity ? (
                <>
                  <span className="text-ink-faint"> / </span>
                  {venue.capacity} cap
                </>
              ) : null}
            </p>
            <p className="mt-3 text-body text-ink-dim">
              {venue.address}
            </p>

            {venue.signals.length > 0 ? (
              <dl className="mt-4">
                {venue.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="grid gap-2 border-t border-rule py-3 font-mono text-meta sm:grid-cols-[5rem_1fr]"
                  >
                    <dt className="uppercase tracking-[0.16em] text-ink-faint">
                      {formatSignalCategory(signal.category)}
                    </dt>
                    <dd className="font-sans text-body normal-case tracking-normal text-ink-dim">
                      {signal.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <VenueUpcoming events={upcomingEvents} feedStatus={feed.status} />

            <a
              href={venue.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex font-sans text-body text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              {venue.source.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
