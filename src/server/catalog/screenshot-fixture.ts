import { launchCatalogData } from "./launch-data";
import type {
  ArtistRecord,
  CatalogSnapshot,
  EventRecord,
  SourceRecord,
  VenueRecord,
} from "./types";

const CHICAGO = "America/Chicago";
const ENABLED_FLAG = "1";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type ScreenshotEventTemplate = {
  id: string;
  title: string;
  slug: string;
  dayOffset: number;
  hour: number;
  minute: number;
  venueSlug: string;
  artistSlugs: string[];
  styles: string[];
  source: SourceRecord;
};

export function isScreenshotFixtureEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.SOUND_CITY_SCREENSHOT_FIXTURE !== ENABLED_FLAG) return false;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    return false;
  }
  if (env.NODE_ENV === "production") return false;
  return true;
}

export function selectCatalogMode(
  env: Record<string, string | undefined> = process.env,
): "database" | "screenshot-fixture" | "launch" {
  if (env.DATABASE_URL) return "database";
  if (isScreenshotFixtureEnabled(env)) return "screenshot-fixture";
  return "launch";
}

export function buildScreenshotCatalog(now: Date = new Date()): CatalogSnapshot {
  const snapshot = structuredClone(launchCatalogData);
  const launchSources = new Map(
    snapshot.events.map((event) => [event.id, event.source]),
  );

  snapshot.venues.push(fixtureWarehouse());
  snapshot.artists.push(lateShiftArtist(), bunkerSignalArtist(), signalTraceArtist());
  snapshot.events = placeEvents(snapshot, now, launchSources);
  return snapshot;
}

function fixtureSource(id: string, title: string, slug: string): SourceRecord {
  return {
    id,
    title,
    url: `https://example.com/sound-city/screenshot/${slug}`,
    lastVerifiedAt: "2026-05-15",
  };
}

function fixtureWarehouse(): VenueRecord {
  const source = fixtureSource(
    "source_fixture_warehouse",
    "Fixture Warehouse calendar",
    "fixture-warehouse",
  );
  return {
    id: "venue_fixture_warehouse",
    citySlug: "chicago",
    name: "Fixture Warehouse",
    slug: "fixture-warehouse",
    neighborhood: "West Loop",
    address: "1 Fixture Ave, Chicago, IL 60607",
    capacity: 150,
    source,
    signals: [
      {
        id: "signal_fixture_warehouse_room",
        venueSlug: "fixture-warehouse",
        category: "room",
        value: "Small warehouse room with a close, loud system.",
        source,
      },
    ],
  };
}

function lateShiftArtist(): ArtistRecord {
  const source = fixtureSource(
    "source_late_shift",
    "Late Shift artist page",
    "late-shift",
  );
  return {
    id: "artist_late_shift",
    citySlug: "chicago",
    name: "Late Shift",
    slug: "late-shift",
    bio: "Hard techno act booked for the smaller warehouse room.",
    styles: ["hard", "techno"],
    showcase: false,
    source,
    links: [
      {
        id: "link_late_shift_soundcloud",
        artistSlug: "late-shift",
        kind: "soundcloud",
        label: "SoundCloud",
        url: "https://example.com/sound-city/screenshot/late-shift",
        source,
      },
    ],
  };
}

function bunkerSignalArtist(): ArtistRecord {
  const source = fixtureSource(
    "source_bunker_signal",
    "Bunker Signal artist page",
    "bunker-signal",
  );
  return {
    id: "artist_bunker_signal",
    citySlug: "chicago",
    name: "Bunker Signal",
    slug: "bunker-signal",
    bio: "Groovy house and techno from a close club system.",
    styles: ["groovy", "house"],
    showcase: false,
    source,
    links: [
      {
        id: "link_bunker_signal_bandcamp",
        artistSlug: "bunker-signal",
        kind: "bandcamp",
        label: "Bandcamp",
        url: "https://example.com/sound-city/screenshot/bunker-signal",
        source,
      },
    ],
  };
}

function signalTraceArtist(): ArtistRecord {
  const source = fixtureSource(
    "source_signal_trace",
    "Signal Trace artist page",
    "signal-trace",
  );
  return {
    id: "artist_signal_trace",
    citySlug: "chicago",
    name: "Signal Trace",
    slug: "signal-trace",
    bio: "Melodic and trance-leaning techno for the longer nights.",
    styles: ["melodic", "trance"],
    showcase: false,
    source,
    links: [
      {
        id: "link_signal_trace_youtube",
        artistSlug: "signal-trace",
        kind: "youtube",
        label: "YouTube",
        url: "https://example.com/sound-city/screenshot/signal-trace",
        source,
      },
    ],
  };
}

function eventTemplates(launchSources: Map<string, SourceRecord>): ScreenshotEventTemplate[] {
  const familySource = launchSources.get("event_family_matters_posthuman");
  const lemtomSource = launchSources.get("event_lemtom_spybar");
  const jeremySource = launchSources.get("event_jeremy_olander_spybar");
  if (!familySource || !lemtomSource || !jeremySource) {
    throw new Error("Screenshot fixture is missing launch event sources");
  }

  return [
    {
      id: "event_family_matters_posthuman",
      title: "Family Matters feat. Posthuman",
      slug: "family-matters-posthuman",
      dayOffset: 0,
      hour: 21,
      minute: 0,
      venueSlug: "smartbar",
      artistSlugs: ["posthuman"],
      styles: ["techno", "house"],
      source: familySource,
    },
    {
      id: "event_screenshot_night_bus",
      title: "Night Bus",
      slug: "night-bus",
      dayOffset: 0,
      hour: 23,
      minute: 30,
      venueSlug: "fixture-warehouse",
      artistSlugs: ["bunker-signal"],
      styles: ["groovy", "house"],
      source: fixtureSource("source_night_bus", "Night Bus listing", "night-bus"),
    },
    {
      id: "event_screenshot_room_warmup",
      title: "Room Warmup",
      slug: "room-warmup",
      dayOffset: 1,
      hour: 22,
      minute: 0,
      venueSlug: "podlasie-club",
      artistSlugs: ["bunker-signal"],
      styles: ["house", "groovy"],
      source: fixtureSource("source_room_warmup", "Room Warmup listing", "room-warmup"),
    },
    {
      id: "event_lemtom_spybar",
      title: "Lemtom at Spybar",
      slug: "lemtom-spybar",
      dayOffset: 2,
      hour: 22,
      minute: 0,
      venueSlug: "spybar",
      artistSlugs: ["lemtom"],
      styles: ["house"],
      source: lemtomSource,
    },
    {
      id: "event_screenshot_late_shift",
      title: "Late Shift Control Room",
      slug: "late-shift-control-room",
      dayOffset: 3,
      hour: 22,
      minute: 30,
      venueSlug: "fixture-warehouse",
      artistSlugs: ["late-shift"],
      styles: ["hard", "techno"],
      source: fixtureSource(
        "source_late_shift_event",
        "Late Shift Control Room listing",
        "late-shift-control-room",
      ),
    },
    {
      id: "event_screenshot_acid_return",
      title: "Acid Return",
      slug: "acid-return",
      dayOffset: 5,
      hour: 22,
      minute: 0,
      venueSlug: "smartbar",
      artistSlugs: ["posthuman"],
      styles: ["techno", "acid"],
      source: fixtureSource("source_acid_return", "Acid Return listing", "acid-return"),
    },
    {
      id: "event_jeremy_olander_spybar",
      title: "Jeremy Olander Open-to-Close",
      slug: "jeremy-olander-open-to-close",
      dayOffset: 8,
      hour: 22,
      minute: 0,
      venueSlug: "spybar",
      artistSlugs: ["jeremy-olander"],
      styles: ["melodic house", "techno"],
      source: jeremySource,
    },
    {
      id: "event_screenshot_trance_corridor",
      title: "Trance Corridor",
      slug: "trance-corridor",
      dayOffset: 12,
      hour: 23,
      minute: 0,
      venueSlug: "podlasie-club",
      artistSlugs: ["signal-trace"],
      styles: ["trance", "melodic"],
      source: fixtureSource(
        "source_trance_corridor",
        "Trance Corridor listing",
        "trance-corridor",
      ),
    },
    {
      id: "event_screenshot_open_room",
      title: "Open Room",
      slug: "open-room",
      dayOffset: 15,
      hour: 22,
      minute: 0,
      venueSlug: "fixture-warehouse",
      artistSlugs: ["late-shift", "bunker-signal"],
      styles: ["house", "hard"],
      source: fixtureSource("source_open_room", "Open Room listing", "open-room"),
    },
  ];
}

function placeEvents(
  snapshot: CatalogSnapshot,
  now: Date,
  launchSources: Map<string, SourceRecord>,
): EventRecord[] {
  const templates = eventTemplates(launchSources);
  const venues = new Map(snapshot.venues.map((venue) => [venue.slug, venue]));
  const artists = new Map(snapshot.artists.map((artist) => [artist.slug, artist]));
  const earliest = templates.reduce((current, event) => {
    const currentMinutes = current.dayOffset * 1440 + current.hour * 60 + current.minute;
    const eventMinutes = event.dayOffset * 1440 + event.hour * 60 + event.minute;
    return eventMinutes < currentMinutes ? event : current;
  });
  const anchor = upcomingAnchorDate(now, earliest);

  return templates.map((template) => {
    const date = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      template.dayOffset,
    );
    const venue = venues.get(template.venueSlug);
    const eventArtists = template.artistSlugs.map((slug) => artists.get(slug));
    if (!venue || eventArtists.some((artist) => !artist)) {
      throw new Error(`Screenshot fixture is missing data for ${template.slug}`);
    }

    return {
      id: template.id,
      citySlug: "chicago",
      title: template.title,
      slug: template.slug,
      startsAt: chicagoWallTimeToUtc(
        date.year,
        date.month,
        date.day,
        template.hour,
        template.minute,
      ).toISOString(),
      venue,
      artists: eventArtists.filter((artist): artist is ArtistRecord => Boolean(artist)),
      styles: template.styles,
      source: template.source,
    };
  });
}

function upcomingAnchorDate(
  now: Date,
  earliest: Pick<ScreenshotEventTemplate, "dayOffset" | "hour" | "minute">,
): CalendarDate {
  let anchor = chicagoCalendarDate(now);
  for (let extraDays = 0; extraDays < 3; extraDays += 1) {
    const date = addCalendarDays(
      anchor.year,
      anchor.month,
      anchor.day,
      earliest.dayOffset,
    );
    const instant = chicagoWallTimeToUtc(
      date.year,
      date.month,
      date.day,
      earliest.hour,
      earliest.minute,
    );
    if (instant.getTime() > now.getTime()) return anchor;
    anchor = addCalendarDays(anchor.year, anchor.month, anchor.day, 1);
  }
  return anchor;
}

function chicagoCalendarDate(instant: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

function addCalendarDays(year: number, month: number, day: number, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function chicagoWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const wantedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wantedUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = chicagoParts(new Date(utc));
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      0,
    );
    const delta = shownAsUtc - wantedUtc;
    if (delta === 0) break;
    utc -= delta;
  }

  return new Date(utc);
}

function chicagoParts(instant: Date): CalendarDate & { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = read("hour");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
  };
}
