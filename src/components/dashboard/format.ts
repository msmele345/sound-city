import type { CatalogVenueSignal } from "./types";

export function formatEventDate(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(startsAt));
}

export function formatEventTime(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(startsAt));
}

export function formatVerifiedDate(lastVerifiedAt: string) {
  const dateOnlyMatch = lastVerifiedAt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(lastVerifiedAt);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatSignalCategory(category: CatalogVenueSignal["category"]) {
  return category.replace("-", " ");
}

const siteNameByHost: Record<string, string> = {
  "ra.co": "Resident Advisor",
  "metrochicago.com": "Metro",
  "spybarchicago.com": "Spybar",
  "podlasiechicago.com": "Podlasie",
};

export function formatSourceDisplayName(title: string) {
  const stripped = title.replace(/^review source:\s*/i, "").trim();
  const url = httpUrl(stripped);
  if (url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const site = siteNameByHost[host] ?? siteNameByHost[host.replace(/^[^.]+\./, "")];
    return site ?? host;
  }

  if (/resident advisor/i.test(stripped)) return "Resident Advisor";

  const shortened = stripped
    .replace(/\s+(listing|venue page|about page|artist page|calendar|page)$/i, "")
    .trim();
  const withoutKind =
    shortened && shortened.split(/\s+/).length > 1 ? shortened : stripped;
  const withoutCity = withoutKind.replace(/\s+chicago$/i, "").trim();
  const named = withoutCity || withoutKind;
  const chicagoName = named.match(/^(\S+)\s+chicago\b/i);
  return chicagoName?.[1] ?? named;
}

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
