import { describe, expect, it } from "vitest";

import { parseDevStaticTarget } from "../dev-parser";
import type { SourceTargetRecord } from "../types";

const target: SourceTargetRecord = {
  id: "target_fixture",
  ownerId: "owner_fixture",
  cityId: "city_chicago",
  url: "https://fixtures.sound-city.test/dev-static",
  sourceType: "other",
  parserStrategy: "dev-static",
  trustLevel: "experimental",
  enabled: true,
  confidenceAdjustment: 0,
  healthStatus: "healthy",
  failureCount: 0,
  rejectionCount: 0,
  duplicateCount: 0,
  refreshCadence: "manual",
  lastFetchedAt: null,
  lastSuccessfulRunAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  notes: "",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("parseDevStaticTarget", () => {
  it("satisfies the parser identity contract", () => {
    const candidates = parseDevStaticTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
    );

    expect(candidates[0].sourceEventKey).toBe("fixture-new-late-shift");
    expect(candidates[0].materialContentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
