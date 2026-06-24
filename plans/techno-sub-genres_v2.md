## Searchable Techno Sub-Genres

Add `melodic`, `groovy`, `hard`, and `trance` as first-class, searchable techno
sub-genres alongside the existing free-form `styles` values.

- Treat these as canonical style tags on events and artists (the existing
  `styles: string[]` columns already hold them — no schema change required).
- Expose them in the public style filter (`src/components/dashboard-shell.tsx`)
  so users can narrow to a techno sub-genre, and in taste-profile style
  selection.
- Parsers and the review queue should normalize incoming style text to these
  canonical tags (e.g. "melodic techno" → `melodic`) so refreshed events are
  searchable under the same vocabulary as hand-entered ones.
- Keep the vocabulary open: these four are seeded canonical tags, not a closed
  enum. Free-form styles remain allowed; canonical tags just get reliable
  filtering and consistent labels.

Acceptance criteria:

- [x] `melodic`, `groovy`, `hard`, and `trance` are selectable in the public
      style filter.
- [x] Events/artists tagged with these styles are returned when filtering by
      them.
- [x] Parser/review normalization maps common variants to the canonical tags.
- [x] No catalog schema migration is required (reuses `styles`).

Searchable Techno Sub-Genres Impl Plan:

 1. Canonical style normalization — TDD

  - Add a shared normalizer, likely src/lib/style-normalization.ts.
  - Canonical tags: melodic, groovy, hard, trance.
  - Map explicit aliases such as melodic techno → melodic and hard techno → hard.
  - Preserve unknown free-form styles and remove duplicates.
  - Avoid broad substring matching that could misclassify styles like hard house.

  2. Apply normalization at ingestion and review

  - Normalize styles emitted by the ICS and RSS parsers.
  - Normalize admin-edited styles at review approval before catalog persistence.
  - Add parser and approval tests proving aliases become canonical tags.

  3. Add public filtering — TDD

  - Extend TasteStyle and dashboard filter options with the four canonical tags.
  - Ensure selecting a tag filters event results by exact normalized style.
  - Apply the selected style filter to the artist listing as well.
  - Keep existing styles and taste-profile persistence working.

  4. Verification and closeout

  - Add component coverage for all four options.
  - Prove both matching events and artists remain visible while non-matches disappear.
  - Run npm test, npm run typecheck, npm run lint, and npm run build.
  - Mark the four acceptance criteria complete in plans/sound-city-v2-architecture.md.
