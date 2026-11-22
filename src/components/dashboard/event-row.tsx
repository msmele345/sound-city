import { isHttpUrl } from "@/lib/http-url";

import { Button } from "./button";
import { formatEventDate, formatEventTime } from "./format";
import { MatchMeter } from "./match-meter";
import { SourceTrustLine } from "./source-trust-line";
import type { CatalogEvent } from "./types";

function EventTitle({
  event,
  className,
  heading: Heading,
}: {
  event: CatalogEvent;
  className: string;
  heading: "h3" | "h4" | "h5";
}) {
  if (!isHttpUrl(event.source.url)) {
    return <Heading className={className}>{event.title}</Heading>;
  }

  return (
    <Heading className={className}>
      <a
        href={event.source.url}
        target="_blank"
        rel="noreferrer"
        className="transition-colors duration-150 hover:text-signal"
      >
        {event.title}
      </a>
    </Heading>
  );
}

type EventRowProps = {
  event: CatalogEvent;
  variant: "recommendation" | "feed" | "compact" | "saved";
  index?: number;
  reason?: string;
  score?: number;
  saved?: boolean;
  dismissed?: boolean;
  attended?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  onAttend?: () => void;
  /** Nested upcoming rows. Venue lists omit the venue name; artist lists include it. */
  compact?: "venue" | "artist";
};

export function EventRow({
  event,
  variant,
  index = 0,
  reason,
  score,
  saved = false,
  dismissed = false,
  attended = false,
  onSave,
  onDismiss,
  onRestore,
  onAttend,
  compact = "venue",
}: EventRowProps) {
  if (variant === "recommendation") {
    return (
      <li
        className="rise group grid grid-cols-1 gap-y-3 border-b border-rule py-6 transition-colors duration-150 hover:bg-panel/60 sm:grid-cols-[auto_1fr] sm:gap-x-8"
        style={{ animationDelay: `${120 + index * 70}ms` }}
      >
        <span className="font-display text-4xl leading-none text-ink-faint transition-colors duration-150 group-hover:text-signal sm:text-5xl">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <EventTitle
              event={event}
              heading="h3"
              className="min-w-0 break-words font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl"
            />
            <p className="font-mono text-meta uppercase tracking-[0.12em] text-ink-dim">
              {formatEventDate(event.startsAt)}
              <span className="text-ink-faint"> &middot; </span>
              {formatEventTime(event.startsAt)}
            </p>
          </div>
          <p className="mt-2 font-mono text-meta uppercase tracking-[0.12em] text-ink-dim">
            {event.venue.name}
            <span className="text-ink-faint"> / </span>
            {event.venue.neighborhood}
          </p>
          <p className="mt-3 max-w-xl text-body text-ink-dim">
            {reason}
          </p>
          <SourceTrustLine source={event.source} />
          <div className="mt-4 flex max-w-full flex-col items-start gap-x-4 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center">
            {score !== undefined ? <MatchMeter score={score} /> : null}
            <Button
              variant="quiet"
              aria-pressed={saved}
              onClick={onSave}
            >
              {saved ? "Saved" : "Save"}
            </Button>
            <Button variant="quiet" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button variant="quiet" onClick={onAttend}>
              Mark attended
            </Button>
          </div>
        </div>
      </li>
    );
  }

  if (variant === "saved") {
    return (
      <li className="border-b border-rule py-5">
        <EventTitle
          event={event}
          heading="h3"
          className="min-w-0 break-words font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink"
        />
        <p className="mt-2 font-mono text-meta uppercase tracking-[0.12em] text-ink-dim">
          {formatEventDate(event.startsAt)}
          <span className="text-ink-faint"> / </span>
          {formatEventTime(event.startsAt)}
          <span className="text-ink-faint"> / </span>
          {event.venue.name}
          <span className="text-ink-faint"> / </span>
          {event.venue.neighborhood}
        </p>
        <div className="mt-4 flex max-w-full flex-col items-start gap-x-4 gap-y-2 sm:flex-row sm:flex-wrap sm:items-center">
          {onSave ? (
            <Button variant="quiet" aria-pressed={saved} onClick={onSave}>
              {saved ? "Saved" : "Save"}
            </Button>
          ) : null}
          {onRestore ? (
            <Button variant="quiet" onClick={onRestore}>
              Restore
            </Button>
          ) : null}
          {onAttend ? (
            <Button
              variant={attended ? "pressed" : "quiet"}
              aria-pressed={attended}
              onClick={onAttend}
            >
              Attended
            </Button>
          ) : null}
        </div>
      </li>
    );
  }

  if (variant === "feed") {
    return (
      <li
        className={`grid grid-cols-1 items-start gap-3 border-b border-rule py-5 sm:grid-cols-[5.5rem_minmax(0,1.5fr)_minmax(7rem,0.8fr)_auto] sm:items-center sm:gap-x-6${
          dismissed ? " opacity-50" : ""
        }`}
      >
        <p className="font-mono text-meta uppercase tracking-[0.08em] text-ink">
          {formatEventTime(event.startsAt)}
        </p>
        <div className="min-w-0">
          <EventTitle
            event={event}
            heading="h3"
            className="min-w-0 break-words font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink"
          />
          <p className="mt-2 font-mono text-meta uppercase tracking-[0.12em] text-ink-dim">
            {event.venue.name}
            <span className="text-ink-faint"> / </span>
            {event.venue.neighborhood}
          </p>
          {event.artists.length > 0 ? (
            <p className="mt-2 text-body text-ink-dim">
              {event.artists.map((artist) => artist.name).join(", ")}
            </p>
          ) : null}
          <SourceTrustLine source={event.source} />
        </div>
        <p className="font-mono text-meta uppercase tracking-[0.14em] text-ink-faint">
          {event.styles.join(" / ")}
        </p>
        <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
          <Button variant="quiet" aria-pressed={saved} onClick={onSave}>
            {saved ? "Saved" : "Save"}
          </Button>
          {dismissed ? (
            <Button variant="quiet" onClick={onRestore}>
              Restore
            </Button>
          ) : (
            <Button variant="quiet" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          <Button
            variant={attended ? "pressed" : "quiet"}
            aria-pressed={attended}
            onClick={onAttend}
          >
            Attended
          </Button>
        </div>
      </li>
    );
  }

  const Heading = compact === "artist" ? "h5" : "h4";

  return (
    <li className="border-t border-rule py-3">
      <EventTitle
        event={event}
        heading={Heading}
        className="font-display text-xl uppercase leading-none text-ink"
      />
      <p className="mt-2 font-mono text-meta uppercase tracking-[0.13em] text-ink-faint">
        {formatEventDate(event.startsAt)}
        <span className="text-ink-faint"> / </span>
        {formatEventTime(event.startsAt)}
        {compact === "artist" ? (
          <>
            <span className="text-ink-faint"> / </span>
            {event.venue.name}
          </>
        ) : null}
      </p>
      <SourceTrustLine source={event.source} />
    </li>
  );
}
