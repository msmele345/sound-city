import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import { selectUpcomingPublicEvents } from "@/server/catalog/public-events";

export async function GET(request: NextRequest) {
  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const store = getCatalogStore();
  const [cities, events] = await Promise.all([
    store.listCities(),
    store.listEvents(citySlug),
  ]);
  const city = cities.find((current) => current.slug === citySlug);

  if (!city) {
    return NextResponse.json({ error: "City not found" }, { status: 404 });
  }

  return NextResponse.json({
    city,
    events: selectUpcomingPublicEvents(events, new Date(), city.timeZone),
  });
}
