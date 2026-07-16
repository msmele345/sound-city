import type { CatalogReader } from "../catalog/catalog-store";
import { parseDevStaticTarget } from "./dev-parser";
import type { RefreshStore } from "./refresh-store";
import { parseRssEventFeedTarget } from "./rss-event-feed-parser";
import type {
  CreateReviewItemInput,
  Fetcher,
  ParserCandidate,
  RefreshRunRecord,
  ReviewItemRecord,
  RunStatus,
  SourceTargetRecord,
  UpdateReviewItemInput,
} from "./types";
import { parseVenueCalendarTarget } from "./venue-calendar-parser";

const defaultMaxRunAgeMs = 15 * 60 * 1000;

type RunManualRefreshInput = {
  cityId: string;
  triggeredBy: string;
  now?: Date;
  fetcher?: Fetcher;
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
  return `No parser is available for strategy: ${target.parserStrategy}`;
}

async function defaultFetcher(
  url: string,
): Promise<{ body: string; contentType: string; status: number }> {
  const response = await fetch(url);
  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") ?? "",
    status: response.status,
  };
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

function toReviewItemInput(candidate: ParserCandidate): CreateReviewItemInput {
  const { sourceEventKey, materialContentHash, ...input } = candidate;
  void sourceEventKey;
  void materialContentHash;
  return input;
}

function toPendingReviewItemUpdate(
  input: CreateReviewItemInput,
): UpdateReviewItemInput {
  const { cityId, runId, sourceTargetId, ...update } = input;
  void cityId;
  void runId;
  void sourceTargetId;
  return update;
}

function fieldDiffs(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): Record<string, { current: unknown; proposed: unknown }> {
  return Object.fromEntries(
    [...new Set([...Object.keys(current), ...Object.keys(proposed)])]
      .sort()
      .filter(
        (field) =>
          JSON.stringify(current[field]) !== JSON.stringify(proposed[field]),
      )
      .map((field) => [
        field,
        {
          current: current[field] ?? null,
          proposed: proposed[field] ?? null,
        },
      ]),
  );
}

async function currentPublishedEventCandidate(
  catalogStore: CatalogReader | undefined,
  cityId: string,
  publishedEventId: string,
  fallback: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!catalogStore) {
    throw new Error(
      "Catalog access is required to create a published event update",
    );
  }
  const city = (await catalogStore.listCities()).find(
    (candidate) => candidate.id === cityId,
  );
  if (!city) {
    throw new Error(`City ${cityId} was not found in the catalog`);
  }
  const event = (await catalogStore.listEvents(city.slug)).find(
    (candidate) => candidate.id === publishedEventId,
  );
  if (!event) {
    throw new Error(`Published event ${publishedEventId} was not found`);
  }

  // Keep last-observed values for source-only material fields that the catalog
  // does not persist yet, then replace every field the published event owns.
  const current: Record<string, unknown> = {
    ...fallback,
    title: event.title,
    startsAt: event.startsAt,
    venueName: event.venue.name,
    styles: event.styles,
  };
  if ("artists" in fallback) {
    current.artists = event.artists.map((artist) => artist.name);
  }
  if ("lineup" in fallback) {
    current.lineup = event.artists.map((artist) => artist.name);
  }
  if ("ticketUrl" in fallback) {
    current.ticketUrl = event.source.url;
  }
  if ("canonicalUrl" in fallback) {
    current.canonicalUrl = event.source.url;
  }
  return current;
}

function toPublishedEventUpdateInput(
  candidate: ParserCandidate,
  publishedEventId: string,
  currentCandidate: Record<string, unknown>,
): CreateReviewItemInput {
  return {
    ...toReviewItemInput(candidate),
    lane: "proposed-update",
    targetEntityType: "event",
    targetEntityId: publishedEventId,
    fieldDiffs: fieldDiffs(currentCandidate, candidate.normalizedDraft),
  };
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

async function createStaleTasksForPastEvents(
  store: RefreshStore,
  catalogStore: CatalogReader,
  runId: string,
  cityId: string,
  now: Date,
): Promise<ReviewItemRecord[]> {
  const cities = await catalogStore.listCities();
  const city = cities.find((c) => c.id === cityId);
  if (!city) {
    return [];
  }

  const cutoff = isoNow(now);
  const events = await catalogStore.listEvents(city.slug);
  const existingStaleEntityIds = new Set(
    (await store.listReviewItems(cityId))
      .filter((item) => item.lane === "stale-task" && item.targetEntityId)
      .map((item) => item.targetEntityId!),
  );

  const pastEvents = events.filter(
    (event) => event.startsAt < cutoff && !existingStaleEntityIds.has(event.id),
  );
  const items: ReviewItemRecord[] = [];

  for (const event of pastEvents) {
    const input: CreateReviewItemInput = {
      cityId,
      runId,
      sourceTargetId: null,
      lane: "stale-task",
      priority: 10,
      confidence: 100,
      confidenceReasons: ["startsAt is before current time"],
      targetEntityType: "event",
      targetEntityId: event.id,
      matchFingerprint: `stale:${event.id}`,
      normalizedDraft: {
        title: event.title,
        startsAt: event.startsAt,
        action: "review-past-event",
      },
      fieldDiffs: null,
      linkedDrafts: [],
      conflicts: {
        staleReason:
          "Past event remains in catalog; do not auto-delete or auto-archive.",
      },
      evidence: {
        sourceUrls: [event.source.url],
        excerpts: [`Catalog event ${event.id} startsAt ${event.startsAt}`],
        contentHashes: [`stale:${event.id}`],
      },
      parserVersion: "stale-detector@1",
      fetchTimestamp: cutoff,
    };

    const item = await store.createReviewItem(input);
    items.push(item);
  }

  return items;
}

export async function runManualRefresh(
  store: RefreshStore,
  input: RunManualRefreshInput,
  catalogStore?: CatalogReader,
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
      const fetchedAt = isoNow(input.now);

      await store.updateSourceTarget(target.id, {
        lastFetchedAt: fetchedAt,
      });

      try {
        const fetcher = input.fetcher ?? defaultFetcher;
        let candidates: ParserCandidate[];

        if (target.parserStrategy === "dev-static") {
          candidates = parseDevStaticTarget(target, run.id, fetchedAt);
        } else if (target.parserStrategy === "venue-calendar") {
          candidates = await parseVenueCalendarTarget(
            target,
            run.id,
            fetchedAt,
            fetcher,
          );
        } else if (target.parserStrategy === "rss-event-feed") {
          const owner = await store.getSourceOwner(target.ownerId);
          candidates = await parseRssEventFeedTarget(
            target,
            run.id,
            fetchedAt,
            fetcher,
            { owner },
          );
        } else {
          throw new Error(unsupportedParserMessage(target));
        }

        const targetReviewItems: ReviewItemRecord[] = [];
        for (const candidate of candidates) {
          const item = await store.withSourceEventObservationTransaction(
            target.id,
            candidate.sourceEventKey,
            async (transactionStore) => {
              const observation =
                await transactionStore.getSourceEventObservation(
                  target.id,
                  candidate.sourceEventKey,
                );
              if (
                observation?.materialContentHash ===
                candidate.materialContentHash
              ) {
                if (observation.latestReviewItemId) {
                  await transactionStore.updateReviewItem(
                    observation.latestReviewItemId,
                    {
                      evidence: candidate.evidence,
                      fetchTimestamp: candidate.fetchTimestamp,
                      parserVersion: candidate.parserVersion,
                    },
                  );
                }
                await transactionStore.updateSourceEventObservation(
                  observation.id,
                  {
                    matchFingerprint: candidate.matchFingerprint,
                    normalizedCandidate: candidate.normalizedDraft,
                    lastSeenAt: fetchedAt,
                    parserVersion: candidate.parserVersion,
                  },
                );
                return null;
              }
              if (observation) {
                const latestItem = observation.latestReviewItemId
                  ? await transactionStore.getReviewItem(
                      observation.latestReviewItemId,
                    )
                  : null;
                if (latestItem?.status === "pending") {
                  let reviewItemInput = toReviewItemInput(candidate);
                  if (
                    latestItem.lane === "proposed-update" &&
                    latestItem.targetEntityId
                  ) {
                    const currentCandidate =
                      await currentPublishedEventCandidate(
                        catalogStore,
                        input.cityId,
                        latestItem.targetEntityId,
                        observation.normalizedCandidate,
                      );
                    reviewItemInput = toPublishedEventUpdateInput(
                      candidate,
                      latestItem.targetEntityId,
                      currentCandidate,
                    );
                  }
                  await transactionStore.updateReviewItem(
                    latestItem.id,
                    toPendingReviewItemUpdate(reviewItemInput),
                  );
                  await transactionStore.updateSourceEventObservation(
                    observation.id,
                    {
                      matchFingerprint: candidate.matchFingerprint,
                      materialContentHash: candidate.materialContentHash,
                      normalizedCandidate: candidate.normalizedDraft,
                      lastSeenAt: fetchedAt,
                      lastChangedAt: fetchedAt,
                      publishedEventId:
                        latestItem.lane === "proposed-update"
                          ? latestItem.targetEntityId
                          : observation.publishedEventId,
                      parserVersion: candidate.parserVersion,
                    },
                  );
                  return null;
                }
                const publishedEventId =
                  observation.publishedEventId ?? latestItem?.publishedEntityId;
                if (
                  latestItem?.status === "approved" &&
                  (latestItem.lane === "new-event" ||
                    latestItem.lane === "proposed-update") &&
                  publishedEventId
                ) {
                  const currentCandidate = await currentPublishedEventCandidate(
                    catalogStore,
                    input.cityId,
                    publishedEventId,
                    observation.normalizedCandidate,
                  );
                  const proposedUpdate =
                    await transactionStore.createReviewItem(
                      toPublishedEventUpdateInput(
                        candidate,
                        publishedEventId,
                        currentCandidate,
                      ),
                    );
                  await transactionStore.updateSourceEventObservation(
                    observation.id,
                    {
                      matchFingerprint: candidate.matchFingerprint,
                      materialContentHash: candidate.materialContentHash,
                      normalizedCandidate: candidate.normalizedDraft,
                      lastSeenAt: fetchedAt,
                      lastChangedAt: fetchedAt,
                      latestReviewItemId: proposedUpdate.id,
                      publishedEventId,
                      parserVersion: candidate.parserVersion,
                    },
                  );
                  return proposedUpdate;
                }
                if (latestItem?.status === "rejected") {
                  let reviewItemInput = toReviewItemInput(candidate);
                  const rejectedPublishedEventId =
                    observation.publishedEventId ??
                    (latestItem.lane === "proposed-update"
                      ? latestItem.targetEntityId
                      : null);
                  if (
                    latestItem.lane === "proposed-update" &&
                    rejectedPublishedEventId
                  ) {
                    const currentCandidate = await currentPublishedEventCandidate(
                      catalogStore,
                      input.cityId,
                      rejectedPublishedEventId,
                      observation.normalizedCandidate,
                    );
                    reviewItemInput = toPublishedEventUpdateInput(
                      candidate,
                      rejectedPublishedEventId,
                      currentCandidate,
                    );
                  }
                  if (
                    reviewItemInput.lane === "proposed-update" &&
                    Object.keys(reviewItemInput.fieldDiffs ?? {}).length === 0
                  ) {
                    await transactionStore.updateSourceEventObservation(
                      observation.id,
                      {
                        matchFingerprint: candidate.matchFingerprint,
                        materialContentHash: candidate.materialContentHash,
                        normalizedCandidate: candidate.normalizedDraft,
                        lastSeenAt: fetchedAt,
                        lastChangedAt: fetchedAt,
                        publishedEventId: rejectedPublishedEventId,
                        parserVersion: candidate.parserVersion,
                      },
                    );
                    return null;
                  }
                  const reopenedItem = await transactionStore.createReviewItem(
                    reviewItemInput,
                  );
                  await transactionStore.updateSourceEventObservation(
                    observation.id,
                    {
                      matchFingerprint: candidate.matchFingerprint,
                      materialContentHash: candidate.materialContentHash,
                      normalizedCandidate: candidate.normalizedDraft,
                      lastSeenAt: fetchedAt,
                      lastChangedAt: fetchedAt,
                      latestReviewItemId: reopenedItem.id,
                      publishedEventId: rejectedPublishedEventId,
                      parserVersion: candidate.parserVersion,
                    },
                  );
                  return reopenedItem;
                }
                throw new Error(
                  `Material change handling is not implemented for source event ${candidate.sourceEventKey}`,
                );
              }

              const createdItem = await transactionStore.createReviewItem(
                toReviewItemInput(candidate),
              );
              await transactionStore.createSourceEventObservation({
                sourceTargetId: target.id,
                sourceEventKey: candidate.sourceEventKey,
                matchFingerprint: candidate.matchFingerprint,
                materialContentHash: candidate.materialContentHash,
                normalizedCandidate: candidate.normalizedDraft,
                seenAt: fetchedAt,
                latestReviewItemId: createdItem.id,
                publishedEventId: null,
                parserVersion: candidate.parserVersion,
              });
              return createdItem;
            },
          );
          if (!item) {
            continue;
          }
          reviewItems.push(item);
          targetReviewItems.push(item);
          applyItemMetrics(metrics, item);
        }

        const duplicateCount = targetReviewItems.filter(
          (item) => item.lane === "possible-duplicate",
        ).length;
        if (duplicateCount > 0) {
          await store.incrementSourceTargetCounters(target.id, {
            duplicateCount,
          });
        }

        await store.updateSourceTarget(target.id, {
          lastSuccessfulRunAt: fetchedAt,
        });

        await log(store, run.id, {
          sourceTargetId: target.id,
          level: "info",
          message: `${target.parserStrategy} parser created ${targetReviewItems.length} review items`,
          metadata: { parserStrategy: target.parserStrategy },
        });
      } catch (error) {
        metrics.sourceTargetsFailed += 1;
        const message = errorMessage(error);
        errorSummary = errorSummary ? `${errorSummary}; ${message}` : message;

        await store.incrementSourceTargetCounters(target.id, {
          failureCount: 1,
        });
        await store.updateSourceTarget(target.id, {
          lastFailureAt: fetchedAt,
          lastFailureReason: message,
        });

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

    if (catalogStore) {
      const staleTasks = await createStaleTasksForPastEvents(
        store,
        catalogStore,
        run.id,
        input.cityId,
        input.now ?? new Date(),
      );
      for (const item of staleTasks) {
        reviewItems.push(item);
        applyItemMetrics(metrics, item);
      }
      await log(store, run.id, {
        level: "info",
        message: `Stale detector created ${staleTasks.length} task(s)`,
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
