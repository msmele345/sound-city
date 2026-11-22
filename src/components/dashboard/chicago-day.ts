import { formatEventDate } from "./format";

const chicago = "America/Chicago";

export function chicagoDayKey(instant: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: chicago,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function shiftDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dayHeading(dayKey: string, todayKey: string, startsAt: string) {
  if (dayKey === todayKey) return "Tonight";
  if (dayKey === shiftDayKey(todayKey, 1)) return "Tomorrow";
  return formatEventDate(startsAt);
}

/**
 * The earliest listed day after tonight, when nothing in the list falls on
 * tonight. Returns null when tonight has a listing, or when there is no
 * later date to link to.
 */
export function nextDateAfterTonight(
  events: readonly { startsAt: string }[],
  now: Date,
) {
  const today = chicagoDayKey(now);
  let hasTonight = false;
  let next: { dayKey: string; startsAt: string } | null = null;

  for (const event of events) {
    const dayKey = chicagoDayKey(new Date(event.startsAt));
    if (dayKey === today) hasTonight = true;
    if (dayKey > today && (!next || dayKey < next.dayKey)) {
      next = { dayKey, startsAt: event.startsAt };
    }
  }

  if (hasTonight || !next) return null;
  return {
    dayKey: next.dayKey,
    label: dayHeading(next.dayKey, today, next.startsAt),
  };
}
