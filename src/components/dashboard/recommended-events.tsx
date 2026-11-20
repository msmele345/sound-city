"use client";

import { useMemo } from "react";

import {
  rankRecommendedEvents,
  type RecommendationActions,
  type TasteProfile,
} from "@/lib/recommendations";

import { EventRow } from "./event-row";
import { TasteProfilePanel } from "./taste-profile-panel";
import type { EventFeedState } from "./types";

function updateIds(ids: string[], id: string, mode: "add" | "remove") {
  const next = new Set(ids);
  if (mode === "add") {
    next.add(id);
  } else {
    next.delete(id);
  }
  return [...next];
}

export function RecommendedEvents({
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
      <TasteProfilePanel
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
            <EventRow
              key={item.event.id}
              event={item.event}
              variant="recommendation"
              index={i}
              reason={item.reason}
              score={item.score}
              saved={item.saved}
              onSave={() => saveEvent(item.event.id)}
              onDismiss={() => dismissEvent(item.event.id)}
              onAttend={() => attendEvent(item.event.id)}
            />
          ))}
        </ol>
      )}
    </>
  );
}
