"use client";

import { useMemo } from "react";

import {
  rankRecommendedEvents,
  type RecommendationActions,
  type TasteProfile,
} from "@/lib/recommendations";

import { EventRow } from "./event-row";
import { LoadingRows } from "./loading-rows";
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
}: {
  feed: EventFeedState;
  profile: TasteProfile;
  actions: RecommendationActions;
  onProfileChange(profile: TasteProfile): void;
  onReset(): void;
  onToggleSaved(event: PersonalizationEvent): void;
  onDismiss(event: PersonalizationEvent): void;
  onAttend(event: PersonalizationEvent): void;
}) {
  const recommendations = useMemo(
    () => rankRecommendedEvents(feed.events, { profile, actions }).slice(0, 5),
    [actions, feed.events, profile],
  );

  return (
    <>
      <TasteProfilePanel
        profile={profile}
        onProfileChange={onProfileChange}
        onReset={onReset}
      />

      {feed.status === "loading" ? (
        <LoadingRows label="Loading recommendation queue" variant="recommendation" />
      ) : feed.status === "error" ? (
        <p className="border-b border-rule py-5 text-body text-ink-dim">
          Recommendation queue is unavailable until the event feed returns.
        </p>
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
