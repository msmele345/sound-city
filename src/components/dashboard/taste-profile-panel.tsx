"use client";

import type { TasteProfile } from "@/lib/recommendations";

import {
  TasteProfileControls,
  tasteSummary,
} from "./taste-profile-controls";

export function TasteProfilePanel({
  profile,
  onProfileChange,
}: {
  profile: TasteProfile;
  onProfileChange(profile: TasteProfile): void;
}) {
  return (
    <div className="mt-5 min-w-0 max-w-[calc(100vw-2.5rem)] border-y border-rule py-4 sm:max-w-none">
      <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.12em] text-ink">
        <span className="sr-only">Taste profile. </span>
        <span>{tasteSummary(profile)}</span>
      </p>
      <div className="mt-4">
        <TasteProfileControls
          profile={profile}
          onProfileChange={onProfileChange}
        />
      </div>
    </div>
  );
}
