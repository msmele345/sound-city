import { describe, expect, it } from "vitest";
import { parseVenueCalendarTarget, type Fetcher } from "../venue-calendar-parser";
import type { SourceTargetRecord } from "../types";

function createTarget(overrides: Partial<SourceTargetRecord> = {}): SourceTargetRecord {
  return {
    id: "target_venue_1",
    ownerId: "owner_1",
    cityId: "city_chicago",
    url: "https://venue.test/calendar.ics",
    sourceType: "official-venue-calendar",
    parserStrategy: "venue-calendar",
    trustLevel: "primary",
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy",
    failureCount: 0,
    rejectionCount: 0,
    duplicateCount: 0,
    refreshCadence: "daily",
    lastFetchedAt: null,
    lastSuccessfulRunAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    notes: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const sampleIcs = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Venue//EN",
  "BEGIN:VEVENT",
  "UID:venue-1@test",
  "DTSTART:20260620T220000Z",
  "DTEND:20260621T030000Z",
  "SUMMARY:Techno Night",
  "LOCATION:The Warehouse",
  "URL:https://venue.test/events/techno-night",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseVenueCalendarTarget", () => {
  it("creates review items from an ICS feed", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: sampleIcs,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cityId: "city_chicago",
      runId: "run_1",
      sourceTargetId: "target_venue_1",
      lane: "new-event",
      targetEntityType: "event",
      targetEntityId: null,
      parserVersion: "venue-calendar@1",
      fetchTimestamp: "2026-06-13T00:00:00.000Z",
    });
    expect(items[0].normalizedDraft).toMatchObject({
      title: "Techno Night",
      venueName: "The Warehouse",
      startsAt: "2026-06-20T22:00:00.000Z",
      ticketUrl: "https://venue.test/events/techno-night",
    });
    expect(items[0].evidence).toEqual({
      sourceUrls: ["https://venue.test/events/techno-night"],
      excerpts: ["Techno Night at The Warehouse on 2026-06-20T22:00:00.000Z"],
      contentHashes: ["venue-1@test:venue-calendar@1"],
    });
    expect(items[0].linkedDrafts).toEqual([
      { type: "venue", name: "The Warehouse" },
    ]);
    expect(items[0].matchFingerprint).toBe(
      "venue-cal:techno-night:2026-06-20t22-00-00-000z:the-warehouse",
    );
    expect(items[0].confidenceReasons).toEqual([
      "official venue calendar",
      "structured ICS feed",
    ]);
  });

  it("applies confidenceAdjustment from the source target", async () => {
    const target = createTarget({ confidenceAdjustment: 10 });
    const fetcher: Fetcher = async () => ({
      body: sampleIcs,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items[0].confidence).toBe(92);
  });

  it("clamps confidence to 0-100 range", async () => {
    const target = createTarget({ confidenceAdjustment: -100 });
    const fetcher: Fetcher = async () => ({
      body: sampleIcs,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items[0].confidence).toBe(0);
  });

  it("uses target URL as fallback when event has no URL", async () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-url@test",
      "DTSTART:20260620T220000Z",
      "SUMMARY:No URL Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: ics,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items[0].normalizedDraft.ticketUrl).toBe("https://venue.test/calendar.ics");
    expect(items[0].evidence.sourceUrls).toEqual(["https://venue.test/calendar.ics"]);
  });

  it("creates no linked drafts when event has no location", async () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-location@test",
      "DTSTART:20260620T220000Z",
      "SUMMARY:No Location Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: ics,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items[0].linkedDrafts).toEqual([]);
    expect(items[0].normalizedDraft.venueName).toBe("");
  });

  it("throws when fetch returns non-200 status", async () => {
    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: "Not Found",
      contentType: "text/plain",
      status: 404,
    });

    await expect(
      parseVenueCalendarTarget(target, "run_1", "2026-06-13T00:00:00.000Z", fetcher),
    ).rejects.toThrow(/status 404/);
  });

  it("throws when content is not ICS (HTML response)", async () => {
    const target = createTarget({ url: "https://venue.test/calendar" });
    const fetcher: Fetcher = async () => ({
      body: "<html><body>JavaScript required</body></html>",
      contentType: "text/html",
      status: 200,
    });

    await expect(
      parseVenueCalendarTarget(target, "run_1", "2026-06-13T00:00:00.000Z", fetcher),
    ).rejects.toThrow(/structured feed/i);
  });

  it("accepts ICS content detected by content-type even without .ics extension", async () => {
    const target = createTarget({ url: "https://venue.test/feed" });
    const fetcher: Fetcher = async () => ({
      body: sampleIcs,
      contentType: "text/calendar; charset=utf-8",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items).toHaveLength(1);
  });

  it("accepts tokenized ICS URLs when content-type is generic", async () => {
    const target = createTarget({
      url: "https://venue.test/calendar.ics?secret=abc123",
    });
    const fetcher: Fetcher = async () => ({
      body: sampleIcs,
      contentType: "application/octet-stream",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items).toHaveLength(1);
  });

  it("returns empty array when ICS feed has no VEVENT blocks", async () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "END:VCALENDAR",
    ].join("\r\n");

    const target = createTarget();
    const fetcher: Fetcher = async () => ({
      body: ics,
      contentType: "text/calendar",
      status: 200,
    });

    const items = await parseVenueCalendarTarget(
      target,
      "run_1",
      "2026-06-13T00:00:00.000Z",
      fetcher,
    );

    expect(items).toEqual([]);
  });
});
