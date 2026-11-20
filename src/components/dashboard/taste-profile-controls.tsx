"use client";

import {
  type StartTimePreference,
  type TasteProfile,
  type TasteStyle,
  type TasteVibe,
  type VenueSizePreference,
} from "@/lib/recommendations";

import { Button } from "./button";
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

function discoveryValueText(level: number) {
  if (level <= 1) return "1 of 5, Mainstream";
  if (level >= 5) return "5 of 5, Underground";
  return `${level} of 5, between Mainstream and Underground`;
}

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
  onReset,
}: {
  profile: TasteProfile;
  onProfileChange(profile: TasteProfile): void;
  onReset(): void;
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

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="discovery-level"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint"
          >
            Discovery level
          </label>
          <span className="font-mono text-sm tabular-nums text-ink">
            {profile.discoveryLevel}
          </span>
        </div>
        <input
          id="discovery-level"
          type="range"
          min="1"
          max="5"
          step="1"
          value={profile.discoveryLevel}
          aria-valuetext={discoveryValueText(profile.discoveryLevel)}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              discoveryLevel: Number(event.target.value),
            })
          }
          className="mt-2 w-full min-w-0 accent-signal"
        />
        <div className="mt-1 flex justify-between gap-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-dim">
          <span>Mainstream</span>
          <span>Underground</span>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={onReset}>Reset to defaults</Button>
      </div>
    </div>
  );
}
