import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import { runScheduledRefresh } from "@/server/refresh/engine";
import { getRefreshStore } from "@/server/refresh/refresh-store";

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Cron authorization required" },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function configurationResponse() {
  return NextResponse.json(
    { error: "Cron refresh is not configured" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret?.trim()) {
    return configurationResponse();
  }

  if (process.env.ADMIN_SECRET?.trim() === expectedSecret) {
    return configurationResponse();
  }

  if (request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return unauthorizedResponse();
  }

  const result = await runScheduledRefresh(
    getRefreshStore(),
    {
      cityId: "city_chicago",
      triggeredBy: "vercel-cron",
    },
    getCatalogStore(),
  );

  return NextResponse.json(
    { run: result.run },
    { headers: { "Cache-Control": "no-store" } },
  );
}
