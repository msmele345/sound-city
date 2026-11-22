import { canonicalTechnoSubGenres } from "@/lib/style-normalization";

import type { CatalogEvent } from "./types";

export function styleFilterOptions(events: CatalogEvent[]) {
  return [
    ...new Set([
      ...canonicalTechnoSubGenres,
      ...events.flatMap((event) => event.styles).toSorted(),
    ]),
  ];
}

export function StyleFilterControl({
  styles,
  activeStyle,
  onStyleChange,
}: {
  styles: string[];
  activeStyle: string;
  onStyleChange(style: string): void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by style"
      className="mt-4 flex flex-wrap items-stretch border-y border-rule font-mono text-label uppercase tracking-[0.16em]"
    >
      {["all", ...styles].map((style) => (
        <button
          key={style}
          type="button"
          aria-pressed={activeStyle === style}
          onClick={() => onStyleChange(style)}
          className={`pressable relative inline-flex min-h-9 min-w-9 shrink-0 items-center pointer-coarse:min-h-11 pointer-coarse:min-w-11 border-r border-rule px-3 py-2 transition-colors duration-150 hover:bg-panel hover:text-signal focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal ${
            activeStyle === style ? "bg-panel text-signal" : "text-ink-dim"
          }`}
        >
          {style}
        </button>
      ))}
    </div>
  );
}
