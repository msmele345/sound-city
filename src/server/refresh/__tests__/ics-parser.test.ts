import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parseIcs, parseIcsDocument } from "../ics-parser";

const certifiedGreenlineIcs = readFileSync(
  resolve(
    process.cwd(),
    "src/server/refresh/__tests__/fixtures/greenline-luma.ics",
  ),
  "utf8",
);

describe("parseIcs", () => {
  it("parses the sanitized Greenline Luma subscription fixture", () => {
    const result = parseIcsDocument(certifiedGreenlineIcs);

    expect(result.warnings).toEqual([]);
    expect(result.events).toHaveLength(13);
    expect(result.events[0]).toMatchObject({
      uid: "evt-R4jlVGB5Ii1x5tZ@events.lu.ma",
      summary: "greenline ep8",
      dtStart: "2025-06-06T04:45:00.000Z",
      dtEnd: "2025-06-06T10:00:00.000Z",
      location: "3201 S State St, Chicago, IL 60616, USA",
      url: "https://luma.com/b5cpkvd7",
    });
    expect(result.events.map((event) => event.url)).toEqual([
      "https://luma.com/b5cpkvd7",
      "https://luma.com/3ydv0is1",
      "https://luma.com/lak4s7ux",
      "https://luma.com/ysx4nuz2",
      "https://luma.com/7w0xk1s2",
      "https://luma.com/qgcb154h",
      "https://luma.com/uyzlea3v",
      "https://luma.com/ke01u2ox",
      "https://luma.com/d9t5fi64",
      "https://luma.com/agofeco8",
      "https://luma.com/40nulu2n",
      "https://luma.com/dn42ztgl",
      "https://luma.com/6ljwnq0g",
    ]);
  });

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

  it("uses calendar-level timezone for floating date-times", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "X-WR-TIMEZONE:America/Chicago",
      "BEGIN:VEVENT",
      "UID:calendar-tz@test",
      "DTSTART:20260620T220000",
      "DTEND:20260621T020000",
      "SUMMARY:Calendar Time Zone Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].dtStart).toBe("2026-06-21T03:00:00.000Z");
    expect(events[0].dtEnd).toBe("2026-06-21T07:00:00.000Z");
  });

  it("uses VTIMEZONE TZID for floating date-times", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/Chicago",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:vtimezone@test",
      "DTSTART:20260620T220000",
      "SUMMARY:VTIMEZONE Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcs(ics);

    expect(events).toHaveLength(1);
    expect(events[0].dtStart).toBe("2026-06-21T03:00:00.000Z");
  });
});
