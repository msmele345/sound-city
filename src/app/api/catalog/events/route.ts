import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";

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

  return NextResponse.json({ city, events });
}
