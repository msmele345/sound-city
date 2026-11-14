import { formatEventDate, formatEventTime, formatSignalCategory } from "./format";
import { SourceTrustLine } from "./source-trust-line";
import type { EventFeedState, VenueDirectoryState } from "./types";

export function VenueDirectory({
  directory,
  feed,
}: {
  directory: VenueDirectoryState;
  feed: EventFeedState;
}) {
  if (directory.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading venue directory
      </p>
    );
  }

  if (directory.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        Venue signals are unavailable. Curated room context will return here.
      </p>
    );
  }

  if (directory.venues.length === 0) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No Chicago venues are verified yet.
      </p>
    );
  }

  return (
    <ol className="mt-1">
      {directory.venues.map((venue, i) => {
        const upcomingEvents =
          feed.status === "ready"
            ? feed.events.filter(
                (event) =>
                  event.venue.slug === venue.slug ||
                  event.venue.name === venue.name,
              )
            : [];

        return (
          <li key={venue.id} className="border-b border-rule py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-3xl uppercase leading-none text-ink">
                {venue.name}
              </h3>
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
              {venue.neighborhood}
              {venue.capacity ? (
                <>
                  <span className="text-ink-faint"> / </span>
                  {venue.capacity} cap
                </>
              ) : null}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">
              {venue.address}
            </p>

            {venue.signals.length > 0 ? (
              <dl className="mt-4">
                {venue.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="grid gap-2 border-t border-rule py-3 font-mono text-xs sm:grid-cols-[5rem_1fr]"
                  >
                    <dt className="uppercase tracking-[0.16em] text-ink-faint">
                      {formatSignalCategory(signal.category)}
                    </dt>
                    <dd className="uppercase tracking-[0.05em] text-ink-dim">
                      {signal.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-4 border-t border-rule pt-4">
              <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
                Upcoming events
              </h4>
              {feed.status === "loading" ? (
                <p className="mt-3 text-sm text-ink-dim">
                  Waiting on verified event feed.
                </p>
              ) : upcomingEvents.length === 0 ? (
                <p className="mt-3 text-sm text-ink-dim">
                  No upcoming events are attached to this venue yet.
                </p>
              ) : (
                <ol className="mt-2">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="border-t border-rule py-3">
                      <h4 className="font-display text-xl uppercase leading-none text-ink">
                        {event.title}
                      </h4>
                      <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
                        {formatEventDate(event.startsAt)}
                        <span className="text-ink-faint"> / </span>
                        {formatEventTime(event.startsAt)}
                      </p>
                      <SourceTrustLine source={event.source} />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <a
              href={venue.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              {venue.source.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
