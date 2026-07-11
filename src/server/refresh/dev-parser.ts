import { buildMaterialContentHash } from "./candidate-identity";
import type {
  CreateReviewItemInput,
  ParserCandidate,
  SourceTargetRecord,
} from "./types";

const parserVersion = "dev-static@1";

type DevFixture = Pick<
  CreateReviewItemInput,
  | "lane"
  | "priority"
  | "confidence"
  | "confidenceReasons"
  | "targetEntityType"
  | "targetEntityId"
  | "matchFingerprint"
  | "normalizedDraft"
  | "fieldDiffs"
  | "linkedDrafts"
  | "conflicts"
>;

const devFixtures: DevFixture[] = [
  {
    lane: "new-event",
    priority: 80,
    confidence: 86,
    confidenceReasons: ["official fixture source", "venue calendar format"],
    targetEntityType: "event",
    targetEntityId: null,
    matchFingerprint: "fixture-new-late-shift",
    normalizedDraft: {
      title: "Late Shift Control Room",
      venueName: "Fixture Warehouse",
      startsAt: "2026-06-19T04:00:00.000Z",
      styles: ["house", "groovy"],
      ticketUrl: "https://fixtures.sound-city.test/dev-static/late-shift",
      agePolicy: "21+",
      price: "$20",
    },
    fieldDiffs: null,
    linkedDrafts: [
      {
        type: "venue",
        name: "Fixture Warehouse",
        neighborhood: "West Loop",
      },
    ],
    conflicts: null,
  },
  {
    lane: "proposed-update",
    priority: 70,
    confidence: 78,
    confidenceReasons: ["title match", "same venue", "nearby start time"],
    targetEntityType: "event",
    targetEntityId: "event_fixture_existing",
    matchFingerprint: "fixture-update-bunker-signal",
    normalizedDraft: {
      title: "Bunker Signal",
      startsAt: "2026-06-20T03:30:00.000Z",
      styles: ["techno", "hard"],
    },
    fieldDiffs: {
      startsAt: {
        current: "2026-06-20T04:00:00.000Z",
        proposed: "2026-06-20T03:30:00.000Z",
      },
      styles: {
        current: ["techno"],
        proposed: ["techno", "hard"],
      },
    },
    linkedDrafts: [],
    conflicts: null,
  },
  {
    lane: "possible-duplicate",
    priority: 55,
    confidence: 54,
    confidenceReasons: ["similar title", "same night", "venue name variant"],
    targetEntityType: "event",
    targetEntityId: "event_fixture_possible_match",
    matchFingerprint: "fixture-dupe-afterhours-loop",
    normalizedDraft: {
      title: "Afterhours Loop",
      venueName: "Fixture Warehouse",
      startsAt: "2026-06-21T06:00:00.000Z",
      styles: ["techno", "trance"],
    },
    fieldDiffs: null,
    linkedDrafts: [],
    conflicts: {
      possibleMatches: ["event_fixture_possible_match"],
      reason: "The fixture title and start time are close to an existing event.",
    },
  },
  {
    lane: "stale-task",
    priority: 30,
    confidence: 92,
    confidenceReasons: ["past event still listed in catalog fixture"],
    targetEntityType: "event",
    targetEntityId: "event_fixture_stale",
    matchFingerprint: "fixture-stale-past-listing",
    normalizedDraft: {
      title: "Expired Listing Sweep",
      startsAt: "2026-05-30T03:00:00.000Z",
      action: "review-past-event",
    },
    fieldDiffs: null,
    linkedDrafts: [],
    conflicts: {
      staleReason: "Past event remains eligible for review; do not auto-delete.",
    },
  },
];

export function parseDevStaticTarget(
  target: SourceTargetRecord,
  runId: string,
  fetchedAt: string,
): ParserCandidate[] {
  return devFixtures.map((fixture) => ({
    ...fixture,
    sourceEventKey: fixture.matchFingerprint,
    materialContentHash: buildMaterialContentHash(fixture.normalizedDraft),
    cityId: target.cityId,
    runId,
    sourceTargetId: target.id,
    evidence: {
      sourceUrls: [target.url],
      excerpts: [`${fixture.normalizedDraft.title} fixture candidate`],
      contentHashes: [`${fixture.matchFingerprint}:${parserVersion}`],
    },
    parserVersion,
    fetchTimestamp: fetchedAt,
  }));
}
