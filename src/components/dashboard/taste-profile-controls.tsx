"use client";

import type {
  StartTimePreference,
  TasteProfile,
  TasteStyle,
  TasteVibe,
  VenueSizePreference,
} from "@/lib/recommendations";

import { Chip } from "./chip";
import { styleOptions } from "./use-personalization";

const vibeOptions: { value: TasteVibe; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "deep", label: "Deep" },
  { value: "melodic", label: "Melodic" },
  { value: "high-energy", label: "High energy" },
];

const venueSizeOptions: { value: VenueSizePreference; label: string }[] = [
  { value: "small-room", label: "Small room" },
  { value: "midsize-club", label: "Midsize club" },
  { value: "warehouse", label: "Warehouse" },
];

const startTimeOptions: { value: StartTimePreference; label: string }[] = [
  { value: "early", label: "Early" },
  { value: "late", label: "Late" },
  { value: "after-hours", label: "After hours" },
];

export function TasteProfileControls({
  profile,
  onProfileChange,
}: {
  profile: TasteProfile;
  onProfileChange(profile: TasteProfile): void;
}) {
  function toggleStyle(style: TasteStyle) {
    const styles = profile.styles.includes(style)
      ? profile.styles.filter((current) => current !== style)
      : [...profile.styles, style];
    onProfileChange({
      ...profile,
      styles: styles.length > 0 ? styles : [style],
    });
  }

  return (
    <div className="mt-5 min-w-0 max-w-[calc(100vw-2.5rem)] border-y border-rule py-4 sm:max-w-none">
      <fieldset>
        <legend className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
          Styles
        </legend>
        <div className="mt-3 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
          {styleOptions.map((style) => (
            <Chip
              key={style}
              pressed={profile.styles.includes(style)}
              checked={profile.styles.includes(style)}
              onChange={() => toggleStyle(style)}
            >
              {style}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="min-w-0 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Vibe
          <select
            value={profile.vibe}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                vibe: event.target.value as TasteVibe,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {vibeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Venue size
          <select
            value={profile.venueSize}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                venueSize: event.target.value as VenueSizePreference,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {venueSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
          Start time
          <select
            value={profile.startTime}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                startTime: event.target.value as StartTimePreference,
              })
            }
            className="mt-2 w-full border border-rule bg-bg px-3 py-2 text-xs uppercase tracking-[0.12em] text-ink"
          >
            {startTimeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
        Discovery level
        <input
          type="range"
          min="1"
          max="5"
          value={profile.discoveryLevel}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              discoveryLevel: Number(event.target.value),
            })
          }
          className="mt-2 w-full min-w-0 accent-signal"
        />
      </label>
    </div>
  );
}
