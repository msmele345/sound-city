import { describe, expect, it } from "vitest";
import { parseIcs } from "../ics-parser";

describe("parseIcs", () => {
  it("parses a basic ICS feed with multiple VEVENT blocks", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test//Test//EN",
      "BEGIN:VEVENT",
      "UID:event-1@test",
      "DTSTART:20260620T220000Z",
      "DTEND:20260621T030000Z",
      "SUMMARY:Techno Night",
      "LOCATION:The Warehouse",
      "DESCRIPTION:Featuring DJ X",
      "URL:https://example.com/event/1",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:event-2@test",
      "DTSTART:20260621T230000Z",
      "SUMMARY:Late Session",
      "LOCATION:The Basement",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: "event-1@test",
      summary: "Techno Night",
      location: "The Warehouse",
      description: "Featuring DJ X",
      url: "https://example.com/event/1",
    });
    expect(events[0].dtStart).toBe("2026-06-20T22:00:00.000Z");
    expect(events[0].dtEnd).toBe("2026-06-21T03:00:00.000Z");
    expect(events[1]).toMatchObject({
      uid: "event-2@test",
      summary: "Late Session",
      location: "The Basement",
    });
    expect(events[1].dtStart).toBe("2026-06-21T23:00:00.000Z");
    expect(events[1].dtEnd).toBeNull();
  });

  it("handles date-only DTSTART values", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:date-only@test",
      "DTSTART;VALUE=DATE:20260620",
      "SUMMARY:All Day Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].dtStart).toBe("2026-06-20T00:00:00.000Z");
  });

  it("handles floating date-time (no timezone)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:floating@test",
      "DTSTART:20260620T220000",
      "SUMMARY:Floating Time Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].dtStart).toBe("2026-06-20T22:00:00.000Z");
  });

  it("unfolds continuation lines", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:folded@test",
      "DTSTART:20260620T220000Z",
      "SUMMARY:A Very Long",
      "  Event Title That Spans",
      "  Multiple Lines",
      "DESCRIPTION:Line one\\n",
      " Line two\\n",
      " Line three",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("A Very Long Event Title That Spans Multiple Lines");
    expect(events[0].description).toBe("Line one\nLine two\nLine three");
  });

  it("unescapes ICS text values", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:escaped@test",
      "DTSTART:20260620T220000Z",
      "SUMMARY:DJ\\, MC & Friends",
      "LOCATION:Club 99\\; Floor 2",
      "DESCRIPTION:Backslash: \\\\",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events[0].summary).toBe("DJ, MC & Friends");
    expect(events[0].location).toBe("Club 99; Floor 2");
    expect(events[0].description).toBe("Backslash: \\");
  });

  it("skips VEVENT blocks without SUMMARY", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-summary@test",
      "DTSTART:20260620T220000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:has-summary@test",
      "DTSTART:20260620T230000Z",
      "SUMMARY:Valid Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("has-summary@test");
  });

  it("skips VEVENT blocks without DTSTART", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-date@test",
      "SUMMARY:No Date Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("  \n  ")).toEqual([]);
  });

  it("returns empty array when no VEVENT blocks exist", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test//EN",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcs(ics)).toEqual([]);
  });

  it("handles LF line endings", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:lf@test",
      "DTSTART:20260620T220000Z",
      "SUMMARY:LF Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("LF Event");
  });

  it("converts timezone-qualified local date-times to UTC", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:tzid@test",
      "DTSTART;TZID=America/Chicago:20260620T220000",
      "DTEND;TZID=America/Chicago:20260621T020000",
      "SUMMARY:Chicago Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].dtStart).toBe("2026-06-21T03:00:00.000Z");
    expect(events[0].dtEnd).toBe("2026-06-21T07:00:00.000Z");
  });
});
