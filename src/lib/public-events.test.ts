import { isUpcomingPublicStart } from "./public-events";

describe("isUpcomingPublicStart", () => {
  it("keeps a start inside the Chicago grace period and drops one at the cutoff", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");

    expect(
      isUpcomingPublicStart("2026-06-15T07:00:00.000Z", now, "America/Chicago"),
    ).toBe(true);
    expect(
      isUpcomingPublicStart("2026-06-15T06:00:00.000Z", now, "America/Chicago"),
    ).toBe(false);
  });
});
