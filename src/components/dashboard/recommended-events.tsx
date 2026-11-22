"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  rankRecommendedEvents,
  type RecommendationActions,
  type TasteProfile,
} from "@/lib/recommendations";

import { feedbackMs, prefersReducedMotion } from "./motion";

type Recommendation = ReturnType<typeof rankRecommendedEvents>[number];

import { nextDateAfterTonight } from "./chicago-day";
import { EventRow } from "./event-row";
import { LoadError } from "./load-error";
import { LoadingRows } from "./loading-rows";
import { NothingTonight } from "./nothing-tonight";
import { TasteProfilePanel } from "./taste-profile-panel";
import type { EventFeedState } from "./types";
import type { PersonalizationEvent } from "./use-personalization";

export function RecommendedEvents({
  feed,
  profile,
  actions,
  onProfileChange,
  onReset,
  onToggleSaved,
  onDismiss,
  onAttend,
  onRetry,
}: {
  feed: EventFeedState;
  profile: TasteProfile;
  actions: RecommendationActions;
  onProfileChange(profile: TasteProfile): void;
  onReset(): void;
  onToggleSaved(event: PersonalizationEvent): void;
  onDismiss(event: PersonalizationEvent): void;
  onAttend(event: PersonalizationEvent): void;
  onRetry(): void;
}) {
  const recommendations = useMemo(
    () => rankRecommendedEvents(feed.events, { profile, actions }).slice(0, 5),
    [actions, feed.events, profile],
  );
  const tonight = useMemo(
    () =>
      feed.status === "ready" ? nextDateAfterTonight(feed.events, new Date()) : null,
    [feed.events, feed.status],
  );
  const [leaving, setLeaving] = useState<{ item: Recommendation; index: number }[]>(
    [],
  );
  const leaveTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = leaveTimers.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  function dismiss(item: Recommendation, index: number) {
    onDismiss(item.event);
    if (prefersReducedMotion()) return;
    setLeaving((current) =>
      current.some((row) => row.item.event.id === item.event.id)
        ? current
        : [...current, { item, index }],
    );
    leaveTimers.current.push(
      window.setTimeout(() => {
        setLeaving((current) =>
          current.filter((row) => row.item.event.id !== item.event.id),
        );
      }, feedbackMs),
    );
  }

  const rows = recommendations.map((item, index) => ({
    item,
    index,
    exiting: false,
  }));
  for (const ghost of leaving) {
    if (rows.some((row) => row.item.event.id === ghost.item.event.id)) continue;
    rows.splice(Math.min(ghost.index, rows.length), 0, {
      item: ghost.item,
      index: ghost.index,
      exiting: true,
    });
  }

  return (
    <>
      <TasteProfilePanel
        profile={profile}
        onProfileChange={onProfileChange}
        onReset={onReset}
      />

      {tonight ? (
        <NothingTonight dayKey={tonight.dayKey} label={tonight.label} />
      ) : null}

      {feed.status === "loading" ? (
        <LoadingRows label="Loading recommendation queue" variant="recommendation" />
      ) : feed.status === "error" ? (
        <LoadError
          message="Recommendation queue is unavailable until the event feed returns."
          onRetry={onRetry}
        />
      ) : recommendations.length === 0 && rows.length === 0 ? (
        <p className="border-b border-rule py-5 text-body text-ink-dim">
          No recommendations remain in the local queue.
        </p>
      ) : (
        <ol className="mt-1">
          {rows.map((row) => (
            <EventRow
              key={row.item.event.id}
              event={row.item.event}
              variant="recommendation"
              index={row.index}
              reason={row.item.reason}
              score={row.item.score}
              saved={row.item.saved}
              exiting={row.exiting}
              onSave={() => onToggleSaved(row.item.event)}
              onDismiss={() => dismiss(row.item, row.index)}
              onAttend={() => onAttend(row.item.event)}
            />
          ))}
        </ol>
      )}
    </>
  );
}
