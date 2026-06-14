import { NextResponse, type NextRequest } from "next/server";

import { getCatalogStore } from "@/server/catalog/catalog-store";
import { getRefreshStore } from "@/server/refresh/refresh-store";
import {
  approveReviewItem,
  rejectReviewItem,
} from "@/server/refresh/review-operations";
import type { ApproveOptions } from "@/server/refresh/review-operations";
import type {
  ReviewLane,
  ReviewStatus,
  UpdateReviewItemInput,
} from "@/server/refresh/types";

// ─── Admin protection ─────────────────────────────────────────────

const adminSecretHeader = "x-sound-city-admin-secret";

function adminProtectionResponse(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) {
    return null;
  }

  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const providedSecret = request.headers.get(adminSecretHeader) ?? bearerToken;

  if (providedSecret === expectedSecret) {
    return null;
  }

  return NextResponse.json(
    { error: "Admin secret required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Admin request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}

function cityIdFromSlug(citySlug: string) {
  return `city_${citySlug.replaceAll("-", "_")}`;
}

// ─── Request body types ───────────────────────────────────────────

type ReviewAction = "approve" | "reject";

type ReviewActionBody = {
  action: ReviewAction;
  id: string;
  acceptedFields?: string[];
  editedDraft?: Record<string, unknown>;
  reason?: string;
  notes?: string;
};

type ReviewUpdateBody = {
  id: string;
  input: UpdateReviewItemInput;
};

type EditableReviewItemInput = Pick<
  UpdateReviewItemInput,
  | "priority"
  | "confidence"
  | "confidenceReasons"
  | "normalizedDraft"
  | "fieldDiffs"
  | "linkedDrafts"
  | "conflicts"
  | "evidence"
  | "reviewNotes"
>;

// ─── Validation ───────────────────────────────────────────────────

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function editableReviewItemInput(input: UpdateReviewItemInput) {
  const editable: EditableReviewItemInput = {};

  if (input.priority !== undefined) editable.priority = input.priority;
  if (input.confidence !== undefined) editable.confidence = input.confidence;
  if (input.confidenceReasons !== undefined) {
    editable.confidenceReasons = input.confidenceReasons;
  }
  if (input.normalizedDraft !== undefined) {
    editable.normalizedDraft = input.normalizedDraft;
  }
  if (input.fieldDiffs !== undefined) editable.fieldDiffs = input.fieldDiffs;
  if (input.linkedDrafts !== undefined) editable.linkedDrafts = input.linkedDrafts;
  if (input.conflicts !== undefined) editable.conflicts = input.conflicts;
  if (input.evidence !== undefined) editable.evidence = input.evidence;
  if (input.reviewNotes !== undefined) editable.reviewNotes = input.reviewNotes;

  return editable;
}

// ─── Route handlers ───────────────────────────────────────────────

/**
 * List review items with optional lane and status filters.
 * `GET /api/admin/review-items?city=chicago&lane=new-event&status=pending`
 */
export async function GET(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const cityId = cityIdFromSlug(citySlug);
  const lane = request.nextUrl.searchParams.get("lane") as ReviewLane | null;
  const status = request.nextUrl.searchParams.get("status") as ReviewStatus | null;
  const store = getRefreshStore();

  let items = await store.listReviewItems(cityId, lane ?? undefined);

  if (status) {
    items = items.filter((item) => item.status === status);
  }

  // Attach decision history per item
  const historyByItem = await Promise.all(
    items.map(async (item) => {
      const history = await store.listDecisionHistory(item.id);
      return [item.id, history] as const;
    }),
  );

  return NextResponse.json(
    {
      items,
      historyByItem: Object.fromEntries(historyByItem),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Approve or reject review items.
 * `POST /api/admin/review-items`
 * Body: { action: "approve" | "reject", id, acceptedFields?, editedDraft?, reason?, notes? }
 */
export async function POST(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  try {
    const body = (await request.json()) as ReviewActionBody;
    const refreshStore = getRefreshStore();
    const catalogStore = getCatalogStore();
    const reviewer = "admin-secret";

    switch (body.action) {
      case "approve": {
        const id = requireString(body.id, "review item id");
        const options: ApproveOptions = {};
        if (body.acceptedFields) {
          options.acceptedFields = body.acceptedFields;
        }
        if (body.editedDraft) {
          options.editedDraft = body.editedDraft;
        }

        const result = await approveReviewItem(
          refreshStore,
          catalogStore,
          id,
          reviewer,
          options,
        );

        const history = await refreshStore.listDecisionHistory(id);

        return NextResponse.json(
          { reviewItem: result.reviewItem, history },
          { status: 200 },
        );
      }

      case "reject": {
        const id = requireString(body.id, "review item id");
        const reason = requireString(body.reason, "rejection reason");

        const result = await rejectReviewItem(
          refreshStore,
          id,
          reviewer,
          reason,
          body.notes,
        );

        const history = await refreshStore.listDecisionHistory(id);

        return NextResponse.json(
          { reviewItem: result.reviewItem, history },
          { status: 200 },
        );
      }

      default:
        throw new Error(
          `Unknown action: ${(body as ReviewActionBody).action}`,
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Update a pending review item's draft or metadata before approval.
 * `PATCH /api/admin/review-items`
 * Body: { id, input: { normalizedDraft?, fieldDiffs?, priority?, ... } }
 */
export async function PATCH(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  try {
    const body = (await request.json()) as ReviewUpdateBody;
    const id = requireString(body.id, "review item id");
    const store = getRefreshStore();

    if (!body.input || typeof body.input !== "object") {
      throw new Error("input is required");
    }

    const item = await store.getReviewItem(id);
    if (!item) {
      throw new Error("Review item not found");
    }
    if (item.status !== "pending") {
      throw new Error(
        `Review item is already ${item.status} and cannot be edited`,
      );
    }

    const updated = await store.updateReviewItem(
      id,
      editableReviewItemInput(body.input),
    );
    return NextResponse.json({ reviewItem: updated }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
