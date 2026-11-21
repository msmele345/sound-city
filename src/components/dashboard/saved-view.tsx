"use client";

import Link from "next/link";

import { isUpcomingPublicStart } from "@/lib/public-events";
import { compareStartsAt } from "@/lib/starts-at";
import type { EventSnapshot } from "@/lib/recommendations";

import { Button } from "./button";
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
    .toSorted((a, b) => compareStartsAt(a.startsAt, b.startsAt));
  const past = snapshots
    .filter((snapshot) => !isUpcomingPublicStart(snapshot.startsAt, now, chicago))
    .toSorted((a, b) => compareStartsAt(a.startsAt, b.startsAt));
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
  const idsWithoutSnapshots = eventActions.actions.savedEventIds.filter(
    (id) => !snapshotIds.has(id),
  );
  const feedReady = feed.status !== "loading";
  const unavailableIds = feedReady ? idsWithoutSnapshots : [];
  const dismissed =
    feed.status === "ready"
      ? feed.events
          .filter(
            (event) =>
              eventActions.actions.dismissedEventIds.includes(event.id) &&
              isUpcomingPublicStart(event.startsAt, now, chicago),
          )
          .toSorted((a, b) => compareStartsAt(a.startsAt, b.startsAt))
      : [];

  return (
    <section id="saved" aria-labelledby="saved-heading" className="min-w-0 scroll-mt-6">
      <SectionMark id="saved-heading" title="Saved" index="Kept / 05" />
      {upcoming.length === 0 &&
      past.length === 0 &&
      unavailableIds.length === 0 &&
      idsWithoutSnapshots.length === 0 ? (
        <EmptyList>Nothing saved yet.</EmptyList>
      ) : null}
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
      {unavailableIds.length > 0 ? (
        <ol className="mt-1">
          {unavailableIds.map((id) => (
            <li key={id} className="border-b border-rule py-5">
              <h3 className="font-display text-2xl uppercase leading-none text-ink">
                Event details unavailable
              </h3>
              <p className="mt-2 text-body text-ink-dim">
                This save has no stored details and is not in the current catalog.
              </p>
              <div className="mt-4">
                <Button variant="quiet" onClick={() => eventActions.removeSaved(id)}>
                  Remove
                </Button>
              </div>
            </li>
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
      <div className="mt-8">
        <h3 className="border-b-2 border-rule-strong pb-2 font-display text-2xl uppercase leading-none text-ink">
          Attended
        </h3>
        {attended.length === 0 ? (
          <EmptyList>Nothing marked attended.</EmptyList>
        ) : (
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
        )}
      </div>
      <div className="mt-8">
        <h3 className="border-b-2 border-rule-strong pb-2 font-display text-2xl uppercase leading-none text-ink">
          Dismissed
        </h3>
        {dismissed.length === 0 ? (
          <EmptyList>Nothing dismissed.</EmptyList>
        ) : (
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
        )}
      </div>
    </section>
  );
}

function EmptyList({ children }: { children: string }) {
  return (
    <p className="border-b border-rule py-5 text-body text-ink-dim">
      {children}{" "}
      <Link
        href="/"
        className="text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
      >
        For You
      </Link>
    </p>
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
