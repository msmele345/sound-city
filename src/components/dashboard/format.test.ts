import { launchCatalogData } from "@/server/catalog/launch-data";

import {
  formatEventDate,
  formatEventTime,
  formatSignalCategory,
  formatSourceDisplayName,
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

  it("shows a short site name for the source titles in the catalog", () => {
    const expected = new Map([
      ["Metro Chicago smartbar venue page", "Metro"],
      ["Spybar Chicago about page", "Spybar"],
      ["Podlasie Club about page", "Podlasie Club"],
      ["Family Matters feat. Posthuman Resident Advisor listing", "Resident Advisor"],
      ["Lemtom at Spybar Resident Advisor listing", "Resident Advisor"],
      ["Jeremy Olander Open-to-Close Resident Advisor listing", "Resident Advisor"],
    ]);
    const titles = new Set([
      ...launchCatalogData.venues.map((venue) => venue.source.title),
      ...launchCatalogData.artists.map((artist) => artist.source.title),
      ...launchCatalogData.events.map((event) => event.source.title),
    ]);

    expect([...titles].sort()).toEqual([...expected.keys()].sort());
    for (const title of titles) {
      expect(formatSourceDisplayName(title)).toBe(expected.get(title));
    }
  });

  it("strips a review-source prefix and names a raw url by its site", () => {
    expect(formatSourceDisplayName("Review source: https://ra.co/events/2403087")).toBe(
      "Resident Advisor",
    );
    expect(
      formatSourceDisplayName("Review source: https://www.metrochicago.com/venue/smartbar/"),
    ).toBe("Metro");
    expect(formatSourceDisplayName("https://www.example.com/events/1")).toBe("example.com");
  });

  it("formats signal categories as their current labels", () => {
    expect(formatSignalCategory("sound")).toBe("sound");
    expect(formatSignalCategory("crowd")).toBe("crowd");
    expect(formatSignalCategory("room")).toBe("room");
    expect(formatSignalCategory("door")).toBe("door");
    expect(formatSignalCategory("layout")).toBe("layout");
  });
});
