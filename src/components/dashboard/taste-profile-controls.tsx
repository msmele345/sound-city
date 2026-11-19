"use client";

import type {
  StartTimePreference,
  TasteProfile,
  TasteStyle,
  TasteVibe,
  VenueSizePreference,
} from "@/lib/recommendations";

import { Chip } from "./chip";
import { SegmentedControl } from "./segmented-control";
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

function optionLabel<Value extends string>(
  options: { value: Value; label: string }[],
  value: Value,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function tasteSummary(profile: TasteProfile) {
  return [
    profile.styles.join(", "),
    optionLabel(vibeOptions, profile.vibe),
    optionLabel(venueSizeOptions, profile.venueSize),
    optionLabel(startTimeOptions, profile.startTime),
    `Discovery ${profile.discoveryLevel}`,
  ].join(" · ");
}

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
    <div className="min-w-0">
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

      <div className="mt-4">
        <SegmentedControl
          label="Vibe"
          name="taste-vibe"
          value={profile.vibe}
          options={vibeOptions}
          onChange={(vibe) => onProfileChange({ ...profile, vibe })}
        />
      </div>

      <div className="mt-4">
        <SegmentedControl
          label="Venue size"
          name="taste-venue-size"
          value={profile.venueSize}
          options={venueSizeOptions}
          onChange={(venueSize) => onProfileChange({ ...profile, venueSize })}
        />
      </div>

      <div className="mt-4">
        <SegmentedControl
          label="Start time"
          name="taste-start-time"
          value={profile.startTime}
          options={startTimeOptions}
          onChange={(startTime) => onProfileChange({ ...profile, startTime })}
        />
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
