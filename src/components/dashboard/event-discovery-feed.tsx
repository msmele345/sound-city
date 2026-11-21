"use client";

import { useMemo } from "react";

import { compareStartsAt } from "@/lib/starts-at";

import { useEventActions } from "./event-actions";
import { EventRow } from "./event-row";
import { formatEventDate } from "./format";
import { StyleFilterControl, styleFilterOptions } from "./style-filter-control";
import type { CatalogEvent, EventFeedState } from "./types";

const chicago = "America/Chicago";

function chicagoDayKey(instant: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: chicago,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function shiftDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayLabel(startsAt: string, now: Date) {
  const day = chicagoDayKey(new Date(startsAt));
  const today = chicagoDayKey(now);
  if (day === today) return "Tonight";
  if (day === shiftDayKey(today, 1)) return "Tomorrow";
  return formatEventDate(startsAt);
}

function groupByDay(events: CatalogEvent[], now: Date) {
  const groups: { label: string; events: CatalogEvent[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.startsAt, now);
    const current = groups.at(-1);
    if (current?.label === label) current.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

export function EventDiscoveryFeed({
  feed,
  activeStyle,
  onStyleChange,
}: {
  feed: EventFeedState;
  activeStyle: string;
  onStyleChange(style: string): void;
}) {
  const eventActions = useEventActions();
  const events = useMemo(
    () =>
      feed.events.toSorted((a, b) => compareStartsAt(a.startsAt, b.startsAt)),
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
      <p className="border-b border-rule py-5 font-mono text-label uppercase tracking-[0.12em] text-ink-dim">
        Loading Chicago event feed
      </p>
    );
  }

  if (feed.status === "error") {
    return (
      <p role="alert" className="border-b border-rule py-5 text-body text-ink-dim">
        Event feed is unavailable. Source-verified listings will return here.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
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
        <p className="border-b border-rule py-5 text-body text-ink-dim">
          No verified events match that style.
        </p>
      ) : (
        <div className="mt-2">
          {groupByDay(visibleEvents, new Date()).map((group) => (
            <section key={group.label} className="mt-6 first:mt-2">
              <h3 className="border-b border-rule pb-2 font-display text-2xl uppercase leading-none text-ink">
                {group.label}
              </h3>
              <ol>
                {group.events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    variant="feed"
                    index={visibleEvents.indexOf(event)}
                    saved={eventActions.actions.savedEventIds.includes(event.id)}
                    dismissed={eventActions.actions.dismissedEventIds.includes(event.id)}
                    attended={eventActions.actions.attendedEventIds.includes(event.id)}
                    onSave={() => eventActions.save(event)}
                    onDismiss={() => eventActions.dismiss(event)}
                    onRestore={() => eventActions.restore(event)}
                    onAttend={() => eventActions.attend(event)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
