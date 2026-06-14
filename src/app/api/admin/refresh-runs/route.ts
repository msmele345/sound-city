import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import {
  listRefreshRunsWithReconciliation,
  runManualRefresh,
} from "@/server/refresh/engine";
import { getRefreshStore } from "@/server/refresh/refresh-store";
import type { RefreshRunLogRecord } from "@/server/refresh/types";

const adminSecretHeader = "x-sound-city-admin-secret";

function adminProtectionResponse(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) {
    return null;
  }

  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const providedSecret = request.headers.get(adminSecretHeader) ?? bearerToken;

  if (providedSecret === expectedSecret) {
    return null;
  }

  return NextResponse.json(
    { error: "Admin secret required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function cityIdFromSlug(citySlug: string) {
  return `city_${citySlug.replaceAll("-", "_")}`;
}

async function logsByRunId(
  store: ReturnType<typeof getRefreshStore>,
  runIds: string[],
) {
  const entries = await Promise.all(
    runIds.map(async (runId) => {
      const logs = await store.listRunLogs(runId);
      return [runId, logs] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, RefreshRunLogRecord[]>;
}

export async function GET(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const cityId = cityIdFromSlug(citySlug);
  const store = getRefreshStore();
  const runs = await listRefreshRunsWithReconciliation(store, cityId);
  const reviewItems = await store.listReviewItems(cityId);
  const logs = await logsByRunId(
    store,
    runs.map((run) => run.id),
  );

  return NextResponse.json(
    { runs, logsByRun: logs, reviewItems },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const cityId = cityIdFromSlug(citySlug);
  const store = getRefreshStore();
  const catalogStore = getCatalogStore();
  const result = await runManualRefresh(
    store,
    {
      cityId,
      triggeredBy: "admin-secret",
    },
    catalogStore,
  );
  const logs = await store.listRunLogs(result.run.id);

  return NextResponse.json(
    { run: result.run, logs, reviewItems: result.reviewItems },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
