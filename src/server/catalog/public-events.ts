import type { EventRecord } from "./types";
import { isUpcomingPublicStart } from "@/lib/public-events";

export { PUBLIC_EVENT_GRACE_HOURS, isUpcomingPublicStart } from "@/lib/public-events";

export function selectUpcomingPublicEvents(
  events: EventRecord[],
  now: Date,
  timeZone: string,
): EventRecord[] {
  return events.filter((event) =>
    isUpcomingPublicStart(event.startsAt, now, timeZone),
  );
}
