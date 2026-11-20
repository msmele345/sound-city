"use client";

import { isUpcomingPublicStart } from "@/server/catalog/public-events";
import type { EventSnapshot } from "@/lib/recommendations";

import { useCatalogData } from "./catalog-context";
import { useEventActions } from "./event-actions";
import { EventRow } from "./event-row";
import { SectionMark } from "./section-mark";
import type { CatalogEvent } from "./types";

const chicago = "America/Chicago";

function eventFromSnapshot(snapshot: EventSnapshot): CatalogEvent {
  return {
    id: snapshot.id,
    title: snapshot.title,
    startsAt: snapshot.startsAt,
    venue: {
      name: snapshot.venueName,
      neighborhood: snapshot.neighborhood,
      capacity: null,
    },
    artists: [],
    styles: [],
    source: {
      title: "",
      url: snapshot.sourceUrl,
      lastVerifiedAt: "",
    },
  };
}

export function SavedView() {
  const eventActions = useEventActions();
  const { feed } = useCatalogData();
  const savedIds = new Set(eventActions.actions.savedEventIds);
  const attendedIds = new Set(eventActions.actions.attendedEventIds);
  const snapshots = (eventActions.actions.savedSnapshots ?? []).filter((snapshot) =>
    savedIds.has(snapshot.id),
  );
  const attended = (eventActions.actions.attendedSnapshots ?? []).filter((snapshot) =>
    attendedIds.has(snapshot.id),
  );
  const now = new Date();
  const upcoming = snapshots
    .filter((snapshot) => isUpcomingPublicStart(snapshot.startsAt, now, chicago))
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = snapshots
    .filter((snapshot) => !isUpcomingPublicStart(snapshot.startsAt, now, chicago))
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const dismissed =
    feed.status === "ready"
      ? feed.events
          .filter(
            (event) =>
              eventActions.actions.dismissedEventIds.includes(event.id) &&
              isUpcomingPublicStart(event.startsAt, now, chicago),
          )
          .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
      : [];

  return (
    <section id="saved" aria-labelledby="saved-heading" className="min-w-0 scroll-mt-6">
      <SectionMark id="saved-heading" title="Saved" index="Kept / 05" />
      {upcoming.length > 0 ? (
        <ol className="mt-1">
          {upcoming.map((snapshot) => (
            <SavedEventRow
              key={snapshot.id}
              snapshot={snapshot}
              onSave={() => eventActions.save(eventFromSnapshot(snapshot))}
            />
          ))}
        </ol>
      ) : null}
      {past.length > 0 ? (
        <div className="mt-8">
          <h3 className="border-b-2 border-rule-strong pb-2 font-display text-2xl uppercase leading-none text-ink">
            Past
          </h3>
          <ol className="mt-1">
            {past.map((snapshot) => (
              <SavedEventRow
                key={snapshot.id}
                snapshot={snapshot}
                onSave={() => eventActions.save(eventFromSnapshot(snapshot))}
              />
            ))}
          </ol>
        </div>
      ) : null}
      {attended.length > 0 ? (
        <div className="mt-8">
          <h3 className="border-b-2 border-rule-strong pb-2 font-display text-2xl uppercase leading-none text-ink">
            Attended
          </h3>
          <ol className="mt-1">
            {attended.map((snapshot) => (
              <EventRow
                key={snapshot.id}
                event={eventFromSnapshot(snapshot)}
                variant="saved"
                attended
                onAttend={() => eventActions.attend(eventFromSnapshot(snapshot))}
              />
            ))}
          </ol>
        </div>
      ) : null}
      {dismissed.length > 0 ? (
        <div className="mt-8">
          <h3 className="border-b-2 border-rule-strong pb-2 font-display text-2xl uppercase leading-none text-ink">
            Dismissed
          </h3>
          <ol className="mt-1">
            {dismissed.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                variant="saved"
                onRestore={() => eventActions.restore(event)}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function SavedEventRow({
  snapshot,
  onSave,
}: {
  snapshot: EventSnapshot;
  onSave(): void;
}) {
  return (
    <EventRow
      event={eventFromSnapshot(snapshot)}
      variant="saved"
      saved
      onSave={onSave}
    />
  );
}
