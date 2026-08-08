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
  const { run } = result;

  return NextResponse.json(
    {
      runId: run.id,
      status: run.status,
      trigger: run.trigger,
      triggeredBy: run.triggeredBy,
      blockedByRunId: run.blockedByRunId,
      summary: {
        sourceTargetsChecked: run.sourceTargetsChecked,
        sourceTargetsFailed: run.sourceTargetsFailed,
        draftsCreated: run.draftsCreated,
        updatesProposed: run.updatesProposed,
        duplicatesFlagged: run.duplicatesFlagged,
        staleTasksCreated: run.staleTasksCreated,
        errorSummary: run.errorSummary,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
