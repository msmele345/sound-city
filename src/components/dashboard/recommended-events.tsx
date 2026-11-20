"use client";

import { useMemo } from "react";

import {
  rankRecommendedEvents,
  type RecommendationActions,
  type TasteProfile,
} from "@/lib/recommendations";

import { Button } from "./button";
import { formatEventDate, formatEventTime } from "./format";
import { MatchMeter } from "./match-meter";
import { SourceTrustLine } from "./source-trust-line";
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
            <li
              key={item.event.id}
              className="rise group grid grid-cols-1 gap-y-3 border-b border-rule py-6 transition-colors duration-150 hover:bg-panel/60 sm:grid-cols-[auto_1fr] sm:gap-x-8"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <span className="font-display text-4xl leading-none text-ink-faint transition-colors duration-150 group-hover:text-signal sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="min-w-0 break-words font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl">
                    {item.event.title}
                  </h3>
                  <p className="font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
                    {formatEventDate(item.event.startsAt)}
                    <span className="text-ink-faint"> &middot; </span>
                    {formatEventTime(item.event.startsAt)}
                  </p>
                </div>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-ink-dim">
                  {item.event.venue.name}
                  <span className="text-ink-faint"> / </span>
                  {item.event.venue.neighborhood}
                </p>
                <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-dim">
                  {item.reason}
                </p>
                <SourceTrustLine source={item.event.source} />
                <div className="mt-4 flex max-w-full flex-col items-start gap-x-4 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <MatchMeter score={item.score} />
                  <Button
                    variant="quiet"
                    aria-pressed={item.saved}
                    onClick={() => saveEvent(item.event.id)}
                  >
                    {item.saved ? "Saved" : "Save"}
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => dismissEvent(item.event.id)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => attendEvent(item.event.id)}
                  >
                    Mark attended
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
