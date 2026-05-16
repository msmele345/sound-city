import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";

export async function GET(request: NextRequest) {
  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const artist = await getCatalogStore().getShowcase(citySlug);

  if (!artist) {
    return NextResponse.json({ error: "Showcase not found" }, { status: 404 });
  }

  return NextResponse.json({ artist });
}
