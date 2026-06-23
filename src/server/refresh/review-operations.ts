import type { CatalogStore } from "../catalog/catalog-store";
import * as CatalogOps from "../catalog/operations";
import type { CreateEventInput, SourceInput } from "../catalog/types";
import { normalizeStyleTags } from "@/lib/style-normalization";
import type { RefreshStore } from "./refresh-store";
import type {
  ReviewItemRecord,
  ReviewLane,
} from "./types";

// ─── Approval options ─────────────────────────────────────────────

export type ApproveOptions = {
  /** Fields to accept for field-level approval (proposed-update lane). */
  acceptedFields?: string[];
  /** Override normalized draft (e.g. after admin edits). */
  editedDraft?: Record<string, unknown>;
};

export type ApproveResult = {
  reviewItem: ReviewItemRecord;
  publishedEntityId: string | null;
  publishedSourceId: string | null;
};

export type RejectResult = {
  reviewItem: ReviewItemRecord;
};

// ─── Validation ───────────────────────────────────────────────────

function assertPresent(value: string | undefined | null, field: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value;
}

// ─── Helpers ──────────────────────────────────────────────────────

function slugFromText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function now(): string {
  return new Date().toISOString();
}

function sourceFromEvidence(
  title: string,
  url: string,
): SourceInput {
  return {
    title,
    url,
    lastVerifiedAt: now(),
  };
}

/**
 * Pick the highest-trust canonical source URL from a review item's evidence.
 * In v2 MVP we simply use the first evidence URL (sources are ordered by trust
 * during matching). A richer trust-ranking is deferred to v2.1.
 */
export function canonicalSourceId(
  item: ReviewItemRecord,
  sourceTargetName?: string,
): string {
  const primaryUrl = item.evidence.sourceUrls[0];
  if (!primaryUrl) {
    throw new Error("Review item has no evidence source URLs");
  }
  const prefix = sourceTargetName
    ? `source_${slugFromText(sourceTargetName)}`
    : `source_review_${slugFromText(item.id)}`;
  return `${prefix}_${slugFromText(primaryUrl)}`;
}

// ─── Draft to catalog inputs ──────────────────────────────────────

type DraftData = {
  title?: string;
  venueName?: string;
  venueSlug?: string;
  startsAt?: string;
  styles?: string[];
  artistNames?: string[];
  artistSlugs?: string[];
  ticketUrl?: string;
  agePolicy?: string;
  price?: string;
};

type LinkedDraft = {
  type: "venue" | "artist";
  name: string;
  slug?: string;
  neighborhood?: string;
  address?: string;
  bio?: string;
  styles?: string[];
};

function draftData(item: ReviewItemRecord): DraftData {
  return item.normalizedDraft as DraftData;
}

function linkedDrafts(item: ReviewItemRecord): LinkedDraft[] {
  return item.linkedDrafts as LinkedDraft[];
}

/**
 * Create a venue from a linked draft if it doesn't already exist in the catalog.
 */
async function ensureVenue(
  catalogStore: CatalogStore,
  draft: DraftData,
  linked: LinkedDraft[],
  sourceTitle: string,
  sourceUrl: string,
  citySlug: string,
): Promise<{ venueSlug: string; created: boolean }> {
  // First check if the venue is referenced by slug in the draft
  if (draft.venueSlug) {
    const venues = await catalogStore.listVenues(citySlug);
    const existing = venues.find((v) => v.slug === draft.venueSlug);
    if (existing) {
      return { venueSlug: draft.venueSlug, created: false };
    }
  }

  // Check linked drafts for a venue
  const venueDraft = linked.find((l) => l.type === "venue");
  const venueName = draft.venueName ?? venueDraft?.name;
  if (!venueName) {
    throw new Error("Review item normalizedDraft is missing venue name");
  }

  const venueSlug = venueDraft?.slug ?? slugFromText(venueName);
  const venues = await catalogStore.listVenues(citySlug);
  const existing = venues.find((v) => v.slug === venueSlug);
  if (existing) {
    return { venueSlug, created: false };
  }

  // Create the venue
  await CatalogOps.createVenue(catalogStore, {
    citySlug,
    name: venueName,
    slug: venueSlug,
    neighborhood: venueDraft?.neighborhood ?? "TBD",
    address: venueDraft?.address ?? "TBD",
  capacity: null,
  source: sourceFromEvidence(sourceTitle, sourceUrl),
  });

  return { venueSlug, created: true };
}

/**
 * Create artists from linked drafts that don't already exist.
 */
async function ensureArtists(
  catalogStore: CatalogStore,
  linked: LinkedDraft[],
  sourceTitle: string,
  sourceUrl: string,
  citySlug: string,
): Promise<string[]> {
  const artistDrafts = linked.filter((l) => l.type === "artist");
  if (artistDrafts.length === 0) {
    return [];
  }

  const existingArtists = await catalogStore.listArtists(citySlug);
  const slugs: string[] = [];

  for (const artistDraft of artistDrafts) {
    const slug = artistDraft.slug ?? slugFromText(artistDraft.name);
    const existing = existingArtists.find((a) => a.slug === slug);
    if (existing) {
      slugs.push(slug);
      continue;
    }

    await CatalogOps.createArtist(catalogStore, {
      citySlug,
      name: artistDraft.name,
      slug,
      bio: artistDraft.bio,
      styles: normalizeStyleTags(artistDraft.styles ?? []),
      showcase: false,
      source: sourceFromEvidence(sourceTitle, sourceUrl),
    });
    slugs.push(slug);
  }

  return slugs;
}

// ─── Lane-specific publish logic ──────────────────────────────────

async function publishNewEvent(
  catalogStore: CatalogStore,
  item: ReviewItemRecord,
  sourceTitle: string,
  sourceUrl: string,
): Promise<{ entityId: string; sourceId: string }> {
  const draft = draftData(item);
  const linked = linkedDrafts(item);

  assertPresent(draft.title, "event title");
  assertPresent(draft.startsAt, "event start date");

  const { venueSlug } = await ensureVenue(
    catalogStore,
    draft,
    linked,
    sourceTitle,
    sourceUrl,
    "chicago",
  );

  const artistSlugs = await ensureArtists(
    catalogStore,
    linked,
    sourceTitle,
    sourceUrl,
    "chicago",
  );

  const eventTitle = draft.title!;
  const eventStartsAt = draft.startsAt!;
  const eventSlug = slugFromText(eventTitle);
  const source = sourceFromEvidence(sourceTitle, sourceUrl);

  const eventInput: CreateEventInput = {
    citySlug: "chicago",
    title: eventTitle,
    slug: eventSlug,
    startsAt: eventStartsAt,
    venueSlug,
    artistSlugs,
    styles: normalizeStyleTags(draft.styles ?? []),
    source,
  };

  const event = await CatalogOps.createEvent(catalogStore, eventInput);

  return { entityId: event.id, sourceId: event.source.id };
}

async function publishEventUpdate(
  catalogStore: CatalogStore,
  item: ReviewItemRecord,
  acceptedFields: string[],
  sourceTitle: string,
  sourceUrl: string,
): Promise<{ entityId: string; sourceId: string }> {
  const targetEntityId = item.targetEntityId;
  if (!targetEntityId) {
    throw new Error("Proposed update review item is missing target entity ID");
  }

  const draft = draftData(item);
  const diffs = item.fieldDiffs as Record<string, { current: unknown; proposed: unknown }> | null;

  if (acceptedFields.length === 0) {
    throw new Error("At least one field must be accepted for a proposed update");
  }

  // Build the update input from accepted fields
  const updateInput: Record<string, unknown> = {};
  for (const field of acceptedFields) {
    const diff = diffs?.[field];
    const value = diff?.proposed ?? (draft as Record<string, unknown>)[field];
    if (value === undefined) {
      throw new Error(`Field "${field}" has no proposed value in the review item`);
    }
    updateInput[field] = value;
  }

  // Add the new source
  const source = sourceFromEvidence(sourceTitle, sourceUrl);

  // Map field names to catalog update input
  const catalogUpdate: Record<string, unknown> = { source };
  if (updateInput.title !== undefined) catalogUpdate.title = updateInput.title;
  if (updateInput.startsAt !== undefined) catalogUpdate.startsAt = updateInput.startsAt;
  if (updateInput.styles !== undefined) {
    catalogUpdate.styles = normalizeStyleTags(updateInput.styles as string[]);
  }
  if (updateInput.venueSlug !== undefined) catalogUpdate.venueSlug = updateInput.venueSlug;
  if (updateInput.artistSlugs !== undefined) catalogUpdate.artistSlugs = updateInput.artistSlugs;

  const event = await CatalogOps.updateEvent(
    catalogStore,
    targetEntityId,
    catalogUpdate as Parameters<typeof CatalogOps.updateEvent>[2],
  );

  return { entityId: targetEntityId, sourceId: event.source.id };
}

async function resolvePossibleDuplicate(
  item: ReviewItemRecord,
): Promise<{ entityId: string | null; sourceId: string | null }> {
  // For possible-duplicate lane, we resolve by acknowledging the match
  // without publishing new content. Link to the existing entity.
  const conflicts = item.conflicts as Record<string, unknown> | null;
  const possibleMatches = conflicts?.possibleMatches as string[] | undefined;
  const targetId = possibleMatches?.[0] ?? item.targetEntityId;
  return { entityId: targetId, sourceId: null };
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Approve a review item. For new-event, creates the event (with linked
 * venue/artist) via catalog operations. For proposed-update, applies accepted
 * field-level changes. All lanes record decision history and collapse
 * evidence to one canonical sourceId.
 */
export async function approveReviewItem(
  refreshStore: RefreshStore,
  catalogStore: CatalogStore,
  itemId: string,
  reviewer: string,
  options: ApproveOptions = {},
): Promise<ApproveResult> {
  const item = await refreshStore.getReviewItem(itemId);
  if (!item) {
    throw new Error("Review item not found");
  }
  if (item.status !== "pending") {
    throw new Error(
      `Review item is already ${item.status} and cannot be approved`,
    );
  }

  const sourceUrl = item.evidence.sourceUrls[0] ?? "unknown";
  const sourceTitle = item.evidence.sourceUrls[0]
    ? `Review source: ${item.evidence.sourceUrls[0]}`
    : "Review source";

  // Allow admin-edited draft
  const effectiveDraft = options.editedDraft ?? item.normalizedDraft;

  let publishedEntityId: string | null = null;
  let publishedSourceId: string | null = null;

  return refreshStore.withTransaction(async (txStore) => {
    switch (item.lane as ReviewLane) {
      case "new-event": {
        const result = await publishNewEvent(
          catalogStore,
          { ...item, normalizedDraft: effectiveDraft },
          sourceTitle,
          sourceUrl,
        );
        publishedEntityId = result.entityId;
        publishedSourceId = result.sourceId;
        break;
      }
      case "proposed-update": {
        const acceptedFields = options.acceptedFields ?? [];
        const result = await publishEventUpdate(
          catalogStore,
          item,
          acceptedFields,
          sourceTitle,
          sourceUrl,
        );
        publishedEntityId = result.entityId;
        publishedSourceId = result.sourceId;

        // Record field-level decisions
        for (const field of acceptedFields) {
          await txStore.createDecisionHistory({
            reviewItemId: item.id,
            decision: "field-accepted",
            fieldName: field,
            reason: null,
            notes: null,
            reviewedBy: reviewer,
          });
        }
        break;
      }
      case "possible-duplicate": {
        const result = await resolvePossibleDuplicate(item);
        publishedEntityId = result.entityId;
        publishedSourceId = result.sourceId;
        break;
      }
      case "stale-task":
      case "source-health": {
        // These lanes are informational — approve acknowledges them
        publishedEntityId = item.targetEntityId;
        break;
      }
      default:
        throw new Error(`Unknown review lane: ${item.lane}`);
    }

    const reviewedAt = now();
    const updated = await txStore.updateReviewItem(item.id, {
      status: "approved",
      reviewedBy: reviewer,
      reviewedAt,
      publishedEntityId,
      publishedSourceId,
    });

    await txStore.createDecisionHistory({
      reviewItemId: item.id,
      decision: "approved",
      fieldName: null,
      reason: null,
      notes: null,
      reviewedBy: reviewer,
    });

    return { reviewItem: updated, publishedEntityId, publishedSourceId };
  });
}

/**
 * Reject a review item. Requires a reason.
 */
export async function rejectReviewItem(
  refreshStore: RefreshStore,
  itemId: string,
  reviewer: string,
  reason: string,
  notes?: string,
): Promise<RejectResult> {
  assertPresent(reason, "rejection reason");

  const item = await refreshStore.getReviewItem(itemId);
  if (!item) {
    throw new Error("Review item not found");
  }
  if (item.status !== "pending") {
    throw new Error(
      `Review item is already ${item.status} and cannot be rejected`,
    );
  }

  return refreshStore.withTransaction(async (txStore) => {
    const reviewedAt = now();
    const updated = await txStore.updateReviewItem(item.id, {
      status: "rejected",
      reviewedBy: reviewer,
      reviewedAt,
      rejectionReason: reason,
      reviewNotes: notes ?? null,
    });

    if (item.sourceTargetId) {
      await txStore.incrementSourceTargetCounters(item.sourceTargetId, {
        rejectionCount: 1,
      });
    }

    await txStore.createDecisionHistory({
      reviewItemId: item.id,
      decision: "rejected",
      fieldName: null,
      reason,
      notes: notes ?? null,
      reviewedBy: reviewer,
    });

    return { reviewItem: updated };
  });
}
