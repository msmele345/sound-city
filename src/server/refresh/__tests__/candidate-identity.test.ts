import { describe, expect, it } from "vitest";

import { buildMaterialContentHash } from "../candidate-identity";

describe("candidate identity", () => {
  it("changes the material hash only for catalog-relevant normalized changes", () => {
    const baseline = {
      title: "Warehouse Night",
      startsAt: "2026-07-12T03:00:00.000Z",
      ticketUrl: "https://tickets.test/event/42?utm_source=feed",
      parserVersion: "rss@1",
      publicationTimestamp: "2026-07-01T00:00:00.000Z",
    };

    const evidenceOnlyChange = {
      ...baseline,
      ticketUrl: "https://tickets.test/event/42?utm_source=newsletter",
      parserVersion: "rss@2",
      publicationTimestamp: "2026-07-02T00:00:00.000Z",
    };
    const materialChange = { ...baseline, title: "Warehouse Night Extended" };

    expect(buildMaterialContentHash(evidenceOnlyChange)).toBe(
      buildMaterialContentHash(baseline),
    );
    expect(buildMaterialContentHash(materialChange)).not.toBe(
      buildMaterialContentHash(baseline),
    );
  });

  it("ignores ordering changes for set-like normalized styles", () => {
    const baseline = {
      title: "Warehouse Night",
      startsAt: "2026-07-12T03:00:00.000Z",
      styles: ["hard", "groovy"],
    };

    expect(
      buildMaterialContentHash({
        ...baseline,
        styles: ["groovy", "hard"],
      }),
    ).toBe(buildMaterialContentHash(baseline));
  });

  it("treats a doors-time correction as a material change", () => {
    const baseline = {
      title: "Warehouse Night",
      startsAt: "2026-07-12T03:00:00.000Z",
      doorsAt: "2026-07-12T02:00:00.000Z",
    };

    expect(
      buildMaterialContentHash({
        ...baseline,
        doorsAt: "2026-07-12T01:30:00.000Z",
      }),
    ).not.toBe(buildMaterialContentHash(baseline));
  });
});
