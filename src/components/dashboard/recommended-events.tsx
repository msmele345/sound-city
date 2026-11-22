"use client";

import { useMemo } from "react";

import {
  rankRecommendedEvents,
  type RecommendationActions,
  type TasteProfile,
} from "@/lib/recommendations";

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
      ) : recommendations.length === 0 ? (
        <p className="border-b border-rule py-5 text-body text-ink-dim">
          No recommendations remain in the local queue.
        </p>
      ) : (
        <ol className="mt-1">
          {recommendations.map((item, i) => (
            <EventRow
              key={item.event.id}
              event={item.event}
              variant="recommendation"
              index={i}
              reason={item.reason}
              score={item.score}
              saved={item.saved}
              onSave={() => onToggleSaved(item.event)}
              onDismiss={() => onDismiss(item.event)}
              onAttend={() => onAttend(item.event)}
            />
          ))}
        </ol>
      )}
    </>
  );
}
