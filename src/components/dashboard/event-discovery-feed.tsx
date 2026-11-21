"use client";

import { useMemo } from "react";

import { useEventActions } from "./event-actions";
import { EventRow } from "./event-row";
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
  const eventActions = useEventActions();
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
        <ol className="mt-1">
          {visibleEvents.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              variant="feed"
              index={i}
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
      )}
    </>
  );
}
