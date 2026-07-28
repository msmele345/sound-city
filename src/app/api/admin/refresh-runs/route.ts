import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import {
  listRefreshRunsWithReconciliation,
  RefreshLeaseConflictError,
  runManualRefresh,
} from "@/server/refresh/engine";
import { getRefreshStore } from "@/server/refresh/refresh-store";
import type {
  RefreshRunLogRecord,
  RefreshTargetOutcomeRecord,
} from "@/server/refresh/types";

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

async function outcomesByRunId(
  store: ReturnType<typeof getRefreshStore>,
  runIds: string[],
) {
  const entries = await Promise.all(
    runIds.map(async (runId) => {
      const outcomes = await store.listRefreshTargetOutcomes(runId);
      return [runId, outcomes] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<
    string,
    RefreshTargetOutcomeRecord[]
  >;
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
  const runIds = runs.map((run) => run.id);
  const [logs, outcomes] = await Promise.all([
    logsByRunId(store, runIds),
    outcomesByRunId(store, runIds),
  ]);

  return NextResponse.json(
    { runs, logsByRun: logs, outcomesByRun: outcomes, reviewItems },
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
  let result;
  try {
    result = await runManualRefresh(
      store,
      {
        cityId,
        triggeredBy: "admin-secret",
      },
      catalogStore,
    );
  } catch (error) {
    if (error instanceof RefreshLeaseConflictError) {
      return NextResponse.json(
        {
          error: "Refresh already active",
          activeRunId: error.activeRunId,
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    throw error;
  }
  const logs = await store.listRunLogs(result.run.id);
  const outcomes = await store.listRefreshTargetOutcomes(result.run.id);

  return NextResponse.json(
    { run: result.run, logs, outcomes, reviewItems: result.reviewItems },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
