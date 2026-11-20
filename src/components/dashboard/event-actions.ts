"use client";

import { usePersonalizationData } from "./personalization-context";
import type { PersonalizationEvent } from "./use-personalization";

function place(event: PersonalizationEvent) {
  return `${event.title} at ${event.venue.name}`;
}

export function useEventActions() {
  const { actions, toggleSaved, dismiss, restore, toggleAttended, announce } =
    usePersonalizationData();

  return {
    actions,
    save(event: PersonalizationEvent) {
      const willSave = !actions.savedEventIds.includes(event.id);
      toggleSaved(event);
      announce(willSave ? `Saved ${place(event)}` : `Removed ${place(event)}`);
    },
    dismiss(event: PersonalizationEvent) {
      dismiss(event.id);
      announce(`Dismissed ${place(event)}`);
    },
    restore(event: PersonalizationEvent) {
      restore(event.id);
      announce(`Restored ${place(event)}`);
    },
    attend(event: PersonalizationEvent) {
      const willAttend = !actions.attendedEventIds.includes(event.id);
      toggleAttended(event);
      announce(
        willAttend
          ? `Attended ${place(event)}`
          : `Removed attended ${place(event)}`,
      );
    },
  };
}
