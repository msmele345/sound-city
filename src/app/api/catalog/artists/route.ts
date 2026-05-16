import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";

export async function GET(request: NextRequest) {
  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const artists = await getCatalogStore().listArtists(citySlug);

  return NextResponse.json({ artists });
}
