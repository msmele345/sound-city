"use client";

import { useMemo } from "react";

import { compareStartsAt } from "@/lib/starts-at";

import { chicagoDayKey, dayHeading, nextDateAfterTonight } from "./chicago-day";
import { useEventActions } from "./event-actions";
import { EventRow } from "./event-row";
import { groupFeedRows } from "./feed-rows";
import { LoadError } from "./load-error";
import { LoadingRows } from "./loading-rows";
import { NothingTonight } from "./nothing-tonight";
import { StyleFilterControl, styleFilterOptions } from "./style-filter-control";
import type { EventFeedState } from "./types";

export function EventDiscoveryFeed({
  feed,
  activeStyle,
  onStyleChange,
  onRetry,
}: {
  feed: EventFeedState;
  activeStyle: string;
  onStyleChange(style: string): void;
  onRetry(): void;
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
  const schedule = useMemo(() => {
    const now = new Date();
    const today = chicagoDayKey(now);
    return {
      tonight: nextDateAfterTonight(visibleEvents, now),
      groups: groupFeedRows(visibleEvents, (event) =>
        chicagoDayKey(new Date(event.startsAt)),
      ).map((group) => ({
        ...group,
        heading: dayHeading(group.label, today, group.rows[0].item.startsAt),
      })),
    };
  }, [visibleEvents]);

  if (feed.status === "loading") {
    return <LoadingRows label="Loading Chicago event feed" variant="feed" />;
  }

  if (feed.status === "error") {
    return (
      <LoadError
        message="Event feed is unavailable. Source-verified listings will return here."
        onRetry={onRetry}
      />
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
          {schedule.tonight ? (
            <NothingTonight
              dayKey={schedule.tonight.dayKey}
              label={schedule.tonight.label}
            />
          ) : null}
          {schedule.groups.map((group) => (
            <section key={group.label} className="mt-6 first:mt-2">
              <h3
                id={`day-${group.label}`}
                className="border-b border-rule pb-2 font-display text-2xl uppercase leading-none text-ink"
              >
                {group.heading}
              </h3>
              <ol>
                {group.rows.map(({ item: event, index }) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    variant="feed"
                    index={index}
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
