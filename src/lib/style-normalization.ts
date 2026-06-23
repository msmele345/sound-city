const styleAliases = new Map<string, string>([
  ["melodic", "melodic"],
  ["melodic techno", "melodic"],
  ["groovy", "groovy"],
  ["groovy techno", "groovy"],
  ["hard", "hard"],
  ["hard techno", "hard"],
  ["trance", "trance"],
  ["trance techno", "trance"],
  ["techno trance", "trance"],
]);

export const canonicalTechnoSubGenres = [
  "melodic",
  "groovy",
  "hard",
  "trance",
] as const;

export type CanonicalTechnoSubGenre =
  (typeof canonicalTechnoSubGenres)[number];

function aliasKey(style: string): string {
  return style.trim().toLowerCase().replaceAll(/[-_]+/g, " ").replaceAll(/\s+/g, " ");
}

export function normalizeStyleTags(styles: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const style of styles) {
    const trimmed = style.trim();
    if (!trimmed) continue;

    const value = styleAliases.get(aliasKey(trimmed)) ?? trimmed;
    const key = aliasKey(value);
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}
