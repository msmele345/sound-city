import { formatEventDate, formatEventTime } from "./format";
import { SourceTrustLine } from "./source-trust-line";
import type { EventFeedState, ShowcaseState } from "./types";

export function ArtistShowcase({
  showcase,
  feed,
  activeStyle,
}: {
  showcase: ShowcaseState;
  feed: EventFeedState;
  activeStyle: string;
}) {
  if (showcase.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading weekly artist showcase
      </p>
    );
  }

  if (showcase.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        Artist showcase is unavailable. Curated listening links will return
        here.
      </p>
    );
  }

  if (!showcase.artist) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No weekly artist showcase is selected yet.
      </p>
    );
  }

  if (
    activeStyle !== "all" &&
    !showcase.artist.styles.includes(activeStyle)
  ) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No featured artist matches {activeStyle}.
      </p>
    );
  }

  const artist = showcase.artist;
  const upcomingEvents =
    feed.status === "ready"
      ? feed.events.filter((event) =>
          event.artists.some(
            (eventArtist) =>
              eventArtist.slug === artist.slug || eventArtist.name === artist.name,
          ),
        )
      : [];

  return (
    <div className="mt-5">
      <div
        aria-hidden
        className="h-1.5 border-b border-rule"
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--color-signal) 0 10px, transparent 10px 20px)",
        }}
      />
      <div className="border-b border-rule py-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-signal">
          Weekly feature
        </p>
        <h3 className="mt-3 font-display text-5xl uppercase leading-[0.85] text-ink">
          {artist.name}
        </h3>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
          {artist.styles.join(" / ")}
        </p>
        <p className="mt-5 text-sm leading-relaxed text-ink-dim">
          {artist.bio}
        </p>
        {artist.links.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {artist.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-b border-rule py-5">
        <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
          Upcoming shows
        </h4>
        {feed.status === "loading" ? (
          <p className="mt-3 text-sm text-ink-dim">
            Waiting on verified event feed.
          </p>
        ) : upcomingEvents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-dim">
            No upcoming Chicago dates are attached to this artist yet.
          </p>
        ) : (
          <ol className="mt-2">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="border-t border-rule py-3">
                <h5 className="font-display text-xl uppercase leading-none text-ink">
                  {event.title}
                </h5>
                <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
                  {formatEventDate(event.startsAt)}
                  <span className="text-ink-faint"> / </span>
                  {formatEventTime(event.startsAt)}
                  <span className="text-ink-faint"> / </span>
                  {event.venue.name}
                </p>
                <SourceTrustLine source={event.source} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
