import { EventRow } from "./event-row";
import { LoadingRows } from "./loading-rows";
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
      <LoadingRows label="Loading weekly artist showcase" variant="showcase" />
    );
  }

  if (showcase.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
        Artist showcase is unavailable. Curated listening links will return
        here.
      </p>
    );
  }

  if (!showcase.artist) {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
        No weekly artist showcase is selected yet.
      </p>
    );
  }

  if (
    activeStyle !== "all" &&
    !showcase.artist.styles.includes(activeStyle)
  ) {
    return (
      <p className="border-b border-rule py-5 text-body text-ink-dim">
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
        <p className="font-mono text-label uppercase tracking-[0.22em] text-signal">
          Weekly feature
        </p>
        <h3 className="mt-3 font-display text-5xl uppercase leading-[0.85] text-ink">
          {artist.name}
        </h3>
        <p className="mt-4 font-mono text-meta uppercase tracking-[0.14em] text-ink-faint">
          {artist.styles.join(" / ")}
        </p>
        <p className="mt-5 text-body text-ink-dim">
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
                className="border border-rule px-3 py-2 font-mono text-label uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-b border-rule py-5">
        <h4 className="font-mono text-label uppercase tracking-[0.18em] text-ink-faint">
          Upcoming shows
        </h4>
        {feed.status === "loading" ? (
          <LoadingRows label="Waiting on verified event feed" variant="compact" />
        ) : upcomingEvents.length === 0 ? (
          <p className="mt-3 text-body text-ink-dim">
            No upcoming Chicago dates are attached to this artist yet.
          </p>
        ) : (
          <ol className="mt-2">
            {upcomingEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                variant="compact"
                compact="artist"
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
