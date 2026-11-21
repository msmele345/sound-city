import { compareStartsAt } from "./starts-at";

describe("compareStartsAt", () => {
  it("orders start times by instant, not by the string", () => {
    const earlier = "2026-11-22T04:00:00.000Z";
    const later = "2026-11-21T23:00:00-06:00";

    expect(earlier.localeCompare(later)).toBeGreaterThan(0);
    expect(compareStartsAt(earlier, later)).toBeLessThan(0);
    expect([later, earlier].toSorted(compareStartsAt)).toEqual([earlier, later]);
  });

  it("treats two invalid start times as equal and sorts them after real times", () => {
    expect(compareStartsAt("nope", "also-nope")).toBe(0);
    expect(
      ["nope", "2026-11-22T04:00:00.000Z", "also-nope"].toSorted(compareStartsAt),
    ).toEqual(["2026-11-22T04:00:00.000Z", "nope", "also-nope"]);
  });
});
