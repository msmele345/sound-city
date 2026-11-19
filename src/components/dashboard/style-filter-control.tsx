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
      className="mt-4 flex flex-col items-start border-y border-rule font-mono text-[0.7rem] uppercase tracking-[0.16em] sm:flex-row sm:flex-wrap"
    >
      {["all", ...styles].map((style) => (
        <button
          key={style}
          type="button"
          aria-pressed={activeStyle === style}
          onClick={() => onStyleChange(style)}
          className={`shrink-0 border-r border-rule px-3 py-2 transition-colors duration-150 hover:bg-panel hover:text-signal ${
            activeStyle === style ? "bg-panel text-signal" : "text-ink-dim"
          }`}
        >
          {style}
        </button>
      ))}
    </div>
  );
}
