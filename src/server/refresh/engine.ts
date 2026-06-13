import { parseDevStaticTarget } from "./dev-parser";
import type { RefreshStore } from "./refresh-store";
import type {
  RefreshRunRecord,
  ReviewItemRecord,
  RunStatus,
  SourceTargetRecord,
} from "./types";

const defaultMaxRunAgeMs = 15 * 60 * 1000;

type RunManualRefreshInput = {
  cityId: string;
  triggeredBy: string;
  now?: Date;
};

type RefreshRunResult = {
  run: RefreshRunRecord;
  reviewItems: ReviewItemRecord[];
};

type ReconciliationOptions = {
  now?: Date;
  maxRunAgeMs?: number;
};

type Metrics = Pick<
  RefreshRunRecord,
  | "sourceTargetsChecked"
  | "sourceTargetsFailed"
  | "draftsCreated"
  | "updatesProposed"
  | "duplicatesFlagged"
  | "staleTasksCreated"
>;

const emptyMetrics: Metrics = {
  sourceTargetsChecked: 0,
  sourceTargetsFailed: 0,
  draftsCreated: 0,
  updatesProposed: 0,
  duplicatesFlagged: 0,
  staleTasksCreated: 0,
};

function isoNow(date = new Date()) {
  return date.toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Refresh failed";
}

function unsupportedParserMessage(target: SourceTargetRecord) {
  return `No Phase 3 parser is available for ${target.parserStrategy}`;
}

function terminalStatus(metrics: Metrics): RunStatus {
  if (metrics.sourceTargetsFailed === 0) {
    return "succeeded";
  }
  if (metrics.sourceTargetsChecked === metrics.sourceTargetsFailed) {
    return "failed";
  }
  return "partial";
}

function applyItemMetrics(metrics: Metrics, item: ReviewItemRecord) {
  switch (item.lane) {
    case "new-event":
      metrics.draftsCreated += 1;
      break;
    case "proposed-update":
      metrics.updatesProposed += 1;
      break;
    case "possible-duplicate":
      metrics.duplicatesFlagged += 1;
      break;
    case "stale-task":
      metrics.staleTasksCreated += 1;
      break;
    case "source-health":
      break;
  }
}

async function log(
  store: RefreshStore,
  runId: string,
  input: {
    sourceTargetId?: string | null;
    level: "info" | "warning" | "error";
    message: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  await store.createRunLog({
    runId,
    sourceTargetId: input.sourceTargetId ?? null,
    level: input.level,
    message: input.message,
    metadata: input.metadata ?? null,
  });
}

export async function runManualRefresh(
  store: RefreshStore,
  input: RunManualRefreshInput,
): Promise<RefreshRunResult> {
  const created = await store.createRefreshRun({
    cityId: input.cityId,
    trigger: "manual",
    triggeredBy: input.triggeredBy,
  });
  const startedAt = isoNow(input.now);
  let metrics = { ...emptyMetrics };
  let errorSummary: string | null = null;
  const reviewItems: ReviewItemRecord[] = [];
  let run = await store.updateRefreshRun(created.id, {
    status: "running",
    startedAt,
  });

  await log(store, run.id, {
    level: "info",
    message: "Refresh run started",
    metadata: { cityId: input.cityId },
  });

  try {
    const targets = (await store.listSourceTargets(input.cityId)).filter(
      (target) => target.enabled,
    );

    for (const target of targets) {
      metrics.sourceTargetsChecked += 1;

      try {
        if (target.parserStrategy !== "dev-static") {
          throw new Error(unsupportedParserMessage(target));
        }

        const fetchedAt = isoNow();
        const candidates = parseDevStaticTarget(target, run.id, fetchedAt);

        for (const candidate of candidates) {
          const item = await store.createReviewItem(candidate);
          reviewItems.push(item);
          applyItemMetrics(metrics, item);
        }

        await log(store, run.id, {
          sourceTargetId: target.id,
          level: "info",
          message: `Dev parser created ${candidates.length} review items`,
          metadata: { parserStrategy: target.parserStrategy },
        });
      } catch (error) {
        metrics.sourceTargetsFailed += 1;
        const message = errorMessage(error);
        errorSummary = errorSummary ? `${errorSummary}; ${message}` : message;
        await log(store, run.id, {
          sourceTargetId: target.id,
          level: "error",
          message,
          metadata: { parserStrategy: target.parserStrategy },
        });
      }
    }

    if (targets.length === 0) {
      await log(store, run.id, {
        level: "warning",
        message: "No enabled source targets found",
      });
    }
  } catch (error) {
    metrics = {
      ...metrics,
      sourceTargetsFailed: Math.max(
        metrics.sourceTargetsFailed,
        metrics.sourceTargetsChecked,
      ),
    };
    errorSummary = errorMessage(error);
    await log(store, run.id, {
      level: "error",
      message: errorSummary,
    });
  } finally {
    run = await store.updateRefreshRun(run.id, {
      status: terminalStatus(metrics),
      finishedAt: isoNow(),
      ...metrics,
      errorSummary,
    });
    await log(store, run.id, {
      level: run.status === "succeeded" ? "info" : "warning",
      message: "Refresh run completed",
      metadata: { status: run.status },
    });
  }

  return { run, reviewItems };
}

export async function listRefreshRunsWithReconciliation(
  store: RefreshStore,
  cityId: string,
  options: ReconciliationOptions = {},
): Promise<RefreshRunRecord[]> {
  const now = options.now ?? new Date();
  const maxRunAgeMs = options.maxRunAgeMs ?? defaultMaxRunAgeMs;
  const runs = await store.listRefreshRuns(cityId);
  const reconciled = await Promise.all(
    runs.map(async (run) => {
      if (run.status !== "running") {
        return run;
      }

      const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : 0;
      const isOrphaned = !startedAt || now.getTime() - startedAt > maxRunAgeMs;
      if (!isOrphaned) {
        return run;
      }

      const updated = await store.updateRefreshRun(run.id, {
        status: "failed",
        finishedAt: isoNow(now),
        errorSummary: "Running refresh exceeded max duration and was reconciled.",
      });
      await log(store, run.id, {
        level: "error",
        message: "Running refresh exceeded max duration and was reconciled.",
      });
      return updated;
    }),
  );

  return reconciled;
}
