"use client";

import { useState } from "react";

import type { TasteProfile } from "@/lib/recommendations";

import { Button } from "./button";
import {
  TasteProfileControls,
  tasteSummary,
} from "./taste-profile-controls";

const controlsId = "taste-profile-controls";

export function TasteProfilePanel({
  profile,
  onProfileChange,
}: {
  profile: TasteProfile;
  onProfileChange(profile: TasteProfile): void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-none">
      <div className="flex items-start justify-between gap-4 border-y border-rule py-3">
        <p className="min-w-0 font-mono text-xs uppercase leading-relaxed tracking-[0.12em] text-ink">
          <span className="sr-only">Taste profile. </span>
          <span>{tasteSummary(profile)}</span>
        </p>
        <Button
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={() => setOpen((current) => !current)}
        >
          Tune
        </Button>
      </div>
      <div id={controlsId} hidden={!open} className="border-b border-rule py-4">
        <TasteProfileControls
          profile={profile}
          onProfileChange={onProfileChange}
        />
      </div>
    </div>
  );
}
