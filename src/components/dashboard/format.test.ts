import {
  formatEventDate,
  formatEventTime,
  formatSignalCategory,
  formatVerifiedDate,
} from "./format";

describe("dashboard formatters", () => {
  it("formats event dates in the Chicago time zone", () => {
    expect(formatEventDate("2026-05-22T02:00:00.000Z")).toBe("Thu, May 21");
    expect(formatEventDate("2026-01-15T05:00:00.000Z")).toBe("Wed, Jan 14");
  });

  it("formats event times in the Chicago time zone", () => {
    expect(formatEventTime("2026-05-22T02:00:00.000Z")).toBe("9:00 PM");
    expect(formatEventTime("2026-01-15T05:00:00.000Z")).toBe("11:00 PM");
  });

  it("formats a date-only verified timestamp as that calendar day", () => {
    expect(formatVerifiedDate("2026-05-15")).toBe("May 15, 2026");
  });

  it("formats signal categories as their current labels", () => {
    expect(formatSignalCategory("sound")).toBe("sound");
    expect(formatSignalCategory("crowd")).toBe("crowd");
    expect(formatSignalCategory("room")).toBe("room");
    expect(formatSignalCategory("door")).toBe("door");
    expect(formatSignalCategory("layout")).toBe("layout");
  });
});
