import { compareStartsAt } from "./starts-at";

describe("compareStartsAt", () => {
  it("orders start times by instant, not by the string", () => {
    const earlier = "2026-11-22T04:00:00.000Z";
    const later = "2026-11-21T23:00:00-06:00";

    expect(earlier.localeCompare(later)).toBeGreaterThan(0);
    expect(compareStartsAt(earlier, later)).toBeLessThan(0);
    expect([later, earlier].toSorted(compareStartsAt)).toEqual([earlier, later]);
  });
});
