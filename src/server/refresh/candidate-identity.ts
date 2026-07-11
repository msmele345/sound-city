import { createHash } from "node:crypto";

const materialFields = [
  "title",
  "startsAt",
  "endsAt",
  "venueName",
  "artists",
  "lineup",
  "canonicalUrl",
  "ticketUrl",
  "price",
  "agePolicy",
  "styles",
  "cancelled",
] as const;

function normalizeForIdentity(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return typeof value === "string" ? value.trim() : value;
}

export function canonicalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "dclid", "msclkid"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function buildMatchFingerprint(
  normalizedDraft: Record<string, unknown>,
): string {
  return [
    normalizedDraft.title,
    normalizedDraft.startsAt,
    normalizedDraft.venueName,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map(normalizeForIdentity)
    .join(":");
}

export function buildMaterialContentHash(
  normalizedDraft: Record<string, unknown>,
): string {
  const materialCandidate = Object.fromEntries(
    materialFields
      .filter((field) => normalizedDraft[field] !== undefined)
      .map((field) => [
        field,
        (field === "canonicalUrl" || field === "ticketUrl") &&
        typeof normalizedDraft[field] === "string"
          ? canonicalizeSourceUrl(normalizedDraft[field])
          : normalizedDraft[field],
      ]),
  );
  const canonical = JSON.stringify(canonicalize(materialCandidate));
  return createHash("sha256").update(canonical).digest("hex");
}
