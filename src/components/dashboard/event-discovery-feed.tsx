"use client";

import { useMemo } from "react";

import { formatEventDate, formatEventTime } from "./format";
import { SourceTrustLine } from "./source-trust-line";
import { StyleFilterControl, styleFilterOptions } from "./style-filter-control";
import type { EventFeedState } from "./types";

export function EventDiscoveryFeed({
  feed,
  activeStyle,
  onStyleChange,
}: {
  feed: EventFeedState;
  activeStyle: string;
  onStyleChange(style: string): void;
}) {
  const events = useMemo(
    () =>
      feed.events.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [feed.events],
  );
  const styles = useMemo(() => styleFilterOptions(events), [events]);
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
      <StyleFilterControl
        styles={styles}
        activeStyle={activeStyle}
        onStyleChange={onStyleChange}
      />
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
                  <h3 className="min-w-0 break-words font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink">
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
                </div>
                <SourceTrustLine source={event.source} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
