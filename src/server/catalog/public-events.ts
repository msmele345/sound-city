import type { EventRecord } from "./types";

/** Civil hours a show remains public after its start, in the city time zone. */
export const PUBLIC_EVENT_GRACE_HOURS = 6;

/**
 * "Past" is decided in the city's time zone, never the server zone or UTC.
 * An event stays on the public catalog while its start is strictly later
 * than the city's wall clock minus {@link PUBLIC_EVENT_GRACE_HOURS}.
 * That keeps a show which started earlier tonight, including one that began
 * before local midnight and is still inside its opening hours after the
 * date rolls over. A start equal to the cutoff has finished its night.
 * The subtraction is civil time in that zone, so a daylight-saving jump
 * changes the elapsed gap by the size of the transition.
 * Admin listings do not use this helper.
 */
export function selectUpcomingPublicEvents(
  events: EventRecord[],
  now: Date,
  timeZone: string,
): EventRecord[] {
  const cutoff = cityWallClockMinusHours(now, timeZone, PUBLIC_EVENT_GRACE_HOURS);
  return events.filter((event) => {
    const start = Date.parse(event.startsAt);
    return Number.isFinite(start) && start > cutoff;
  });
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function cityWallClockMinusHours(now: Date, timeZone: string, hours: number): number {
  const parts = zonedParts(now, timeZone);
  const shifted = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour - hours,
      parts.minute,
      parts.second,
      now.getMilliseconds(),
    ),
  );

  return wallTimeToUtc(
    timeZone,
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  );
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = read("hour");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

function wallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): number {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let utc = wanted;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = zonedParts(new Date(utc), timeZone);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
      millisecond,
    );
    const delta = shownAsUtc - wanted;
    if (delta === 0) return utc;
    utc -= delta;
  }

  // A civil time inside a daylight-saving gap does not exist. The last
  // adjustment lands on the instant the clock jumped to.
  return utc;
}
