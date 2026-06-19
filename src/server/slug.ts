/**
 * Shared slug generator used by the refresh engine (dedup keys), review
 * approval reconciliation, and catalog writes. All three depend on identical
 * output — keep a single implementation here so dedup never silently drifts.
 */
export function slugFromText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
