import type {
  HealthStatus,
  RefreshTargetOutcomeRecord,
} from "./types";

export type SourceTargetHealthSummary = {
  status: Exclude<HealthStatus, "disabled">;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  warning: string | null;
};

const successfulStatuses = new Set<RefreshTargetOutcomeRecord["status"]>([
  "succeeded",
  "unchanged",
]);

function outcomeTime(outcome: RefreshTargetOutcomeRecord) {
  return outcome.finishedAt ?? outcome.startedAt;
}

export function deriveSourceTargetHealth(
  outcomes: RefreshTargetOutcomeRecord[],
): SourceTargetHealthSummary {
  let status: SourceTargetHealthSummary["status"] = "healthy";
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;

  const terminalOutcomes = outcomes
    .filter(
      (outcome) =>
        outcome.status === "failed" ||
        successfulStatuses.has(outcome.status),
    )
    .toSorted((left, right) =>
      outcomeTime(left).localeCompare(outcomeTime(right)),
    );

  for (const outcome of terminalOutcomes) {
    if (outcome.status === "failed") {
      consecutiveFailures += 1;
      consecutiveSuccesses = 0;
      if (consecutiveFailures >= 4) {
        status = "failing";
      } else if (consecutiveFailures >= 2) {
        status = "degraded";
      }
      continue;
    }

    consecutiveSuccesses += 1;
    consecutiveFailures = 0;
    if (consecutiveSuccesses >= 2) {
      status = "healthy";
    } else if (status === "failing") {
      status = "degraded";
    }
  }

  return {
    status,
    consecutiveFailures,
    consecutiveSuccesses,
    warning:
      consecutiveFailures === 1
        ? "1 consecutive source failure"
        : null,
  };
}
