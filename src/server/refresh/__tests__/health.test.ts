import { describe, expect, it } from "vitest";

import { deriveSourceTargetHealth } from "../health";
import type {
  RefreshTargetOutcomeRecord,
  RefreshTargetOutcomeStatus,
} from "../types";

function outcome(
  status: RefreshTargetOutcomeStatus,
  index: number,
): RefreshTargetOutcomeRecord {
  const timestamp = new Date(
    Date.UTC(2026, 6, 26, 12, index),
  ).toISOString();
  return {
    id: `outcome_${index}`,
    runId: `run_${index}`,
    sourceTargetId: "target_1",
    status,
    startedAt: timestamp,
    finishedAt: timestamp,
    candidateCount: 0,
    createdCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    warningCount: 0,
    errorDetails: null,
    requestDurationMs: null,
    responseStatus: null,
    responseSizeBytes: null,
    retryCount: 0,
    finalUrl: null,
  };
}

describe("deriveSourceTargetHealth", () => {
  it("ignores skipped outcomes when deriving consecutive failures", () => {
    expect(
      deriveSourceTargetHealth([
        outcome("failed", 0),
        outcome("skipped", 1),
        outcome("failed", 2),
      ]),
    ).toMatchObject({
      status: "degraded",
      consecutiveFailures: 2,
      consecutiveSuccesses: 0,
    });
  });

  it("counts unchanged outcomes toward gradual recovery", () => {
    expect(
      deriveSourceTargetHealth([
        outcome("failed", 0),
        outcome("failed", 1),
        outcome("failed", 2),
        outcome("failed", 3),
        outcome("succeeded", 4),
        outcome("unchanged", 5),
      ]),
    ).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
      consecutiveSuccesses: 2,
      warning: null,
    });
  });
});
