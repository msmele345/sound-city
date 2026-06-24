export type IcsEvent = {
  uid: string;
  summary: string;
  dtStart: string;
  dtEnd: string | null;
  location: string | null;
  description: string | null;
  categories: string[];
  url: string | null;
};

function unfoldLines(text: string): string[] {
  const raw = text.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type IcsDateParams = {
  tzid?: string;
};

type ParsedDateTime = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  z: string;
};

function partMapForTimeZone(date: Date, timeZone: string): Map<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  return new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partMapForTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.get("year")),
    Number(parts.get("month")) - 1,
    Number(parts.get("day")),
    Number(parts.get("hour")),
    Number(parts.get("minute")),
    Number(parts.get("second")),
  );

  return asUtc - date.getTime();
}

function dateTimeInTimeZoneToIso(dateTime: ParsedDateTime, timeZone: string): string {
  const localAsUtc = Date.UTC(
    Number(dateTime.year),
    Number(dateTime.month) - 1,
    Number(dateTime.day),
    Number(dateTime.hour),
    Number(dateTime.minute),
    Number(dateTime.second),
  );

  const offset = getTimeZoneOffsetMs(new Date(localAsUtc), timeZone);
  const utc = localAsUtc - offset;
  const adjustedOffset = getTimeZoneOffsetMs(new Date(utc), timeZone);

  return new Date(localAsUtc - adjustedOffset).toISOString();
}

function parseIcsDate(value: string, params: IcsDateParams = {}): string {
  const dateTimeMatch = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
  );
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second, z] = dateTimeMatch;
    if (!z && params.tzid) {
      try {
        return dateTimeInTimeZoneToIso(
          { year, month, day, hour, minute, second, z },
          params.tzid,
        );
      } catch {
        // Fall back to the previous floating-time behavior for unknown TZIDs.
      }
    }

    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${z || "Z"}`;
    return new Date(iso).toISOString();
  }

  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
  }

  return value;
}

type ParsedProperty = {
  name: string;
  params: IcsDateParams;
  value: string;
};

function parsePropertyLine(line: string): ParsedProperty | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;

  const namePart = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [rawName, ...rawParams] = namePart.split(";");
  const name = rawName.toUpperCase();
  const params: IcsDateParams = {};

  for (const rawParam of rawParams) {
    const equalsIndex = rawParam.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = rawParam.slice(0, equalsIndex).toUpperCase();
    const paramValue = rawParam.slice(equalsIndex + 1).replace(/^"|"$/g, "");
    if (key === "TZID") params.tzid = paramValue;
  }

  return { name, params, value };
}

function extractVEventBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    if (upper === "BEGIN:VEVENT") {
      current = [];
    } else if (upper === "END:VEVENT") {
      if (current) blocks.push(current);
      current = null;
    } else if (current) {
      current.push(line);
    }
  }

  return blocks;
}

function extractCalendarTimeZone(lines: string[]): string | undefined {
  let inEvent = false;
  let inVTimeZone = false;
  let vTimeZoneTzid: string | undefined;

  for (const line of lines) {
    const upper = line.toUpperCase().trim();

    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      continue;
    }
    if (upper === "END:VEVENT") {
      inEvent = false;
      continue;
    }
    if (inEvent) continue;

    if (upper === "BEGIN:VTIMEZONE") {
      inVTimeZone = true;
      continue;
    }
    if (upper === "END:VTIMEZONE") {
      inVTimeZone = false;
      continue;
    }

    const property = parsePropertyLine(line);
    if (!property) continue;

    const value = property.value.trim();
    if (property.name === "X-WR-TIMEZONE" && value) return value;
    if (inVTimeZone && property.name === "TZID" && value && !vTimeZoneTzid) {
      vTimeZoneTzid = value;
    }
  }

  return vTimeZoneTzid;
}

function dateParamsWithCalendarFallback(
  params: IcsDateParams,
  calendarTimeZone: string | undefined,
): IcsDateParams {
  if (params.tzid || !calendarTimeZone) return params;
  return { ...params, tzid: calendarTimeZone };
}

function parseVEventBlock(
  lines: string[],
  calendarTimeZone: string | undefined,
): IcsEvent | null {
  const properties = new Map<string, ParsedProperty>();

  for (const line of lines) {
    const property = parsePropertyLine(line);
    if (!property) continue;
    if (!properties.has(property.name)) {
      properties.set(property.name, property);
    }
  }

  const summary = properties.get("SUMMARY")?.value;
  const dtStart = properties.get("DTSTART");

  if (!summary || !dtStart) return null;

  const dtEnd = properties.get("DTEND");

  return {
    uid: properties.get("UID")?.value ?? "",
    summary: unescapeIcsText(summary.trim()),
    dtStart: parseIcsDate(
      dtStart.value.trim(),
      dateParamsWithCalendarFallback(dtStart.params, calendarTimeZone),
    ),
    dtEnd: dtEnd
      ? parseIcsDate(
          dtEnd.value.trim(),
          dateParamsWithCalendarFallback(dtEnd.params, calendarTimeZone),
        )
      : null,
    location: properties.get("LOCATION")?.value
      ? unescapeIcsText(properties.get("LOCATION")!.value.trim())
      : null,
    description: properties.get("DESCRIPTION")?.value
      ? unescapeIcsText(properties.get("DESCRIPTION")!.value.trim())
      : null,
    categories: properties.get("CATEGORIES")?.value
      ? properties
          .get("CATEGORIES")!
          .value.split(/(?<!\\),/)
          .map((category) => unescapeIcsText(category.trim()))
          .filter(Boolean)
      : [],
    url: properties.get("URL")?.value ? properties.get("URL")!.value.trim() : null,
  };
}

export function parseIcs(text: string): IcsEvent[] {
  if (!text.trim()) return [];

  const lines = unfoldLines(text);
  const blocks = extractVEventBlocks(lines);
  const calendarTimeZone = extractCalendarTimeZone(lines);
  const events: IcsEvent[] = [];

  for (const block of blocks) {
    const event = parseVEventBlock(block, calendarTimeZone);
    if (event) events.push(event);
  }

  return events;
}
