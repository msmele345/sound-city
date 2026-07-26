import { NextResponse, type NextRequest } from "next/server";

import { getRefreshStore } from "@/server/refresh/refresh-store";
import { deriveSourceTargetHealth } from "@/server/refresh/health";
import {
  createSourceOwner,
  createSourceTarget,
  deleteSourceOwner,
  deleteSourceTarget,
  updateSourceOwner,
  updateSourceTarget,
} from "@/server/refresh/operations";
import type {
  CreateSourceOwnerInput,
  CreateSourceTargetInput,
  UpdateSourceOwnerInput,
  UpdateSourceTargetInput,
} from "@/server/refresh/types";

type RefreshEntity = "sourceOwner" | "sourceTarget";

type AdminMutationBody = {
  entity?: RefreshEntity;
  id?: string;
  input?: unknown;
};

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

/**
 * Refresh records are keyed by `cityId` (e.g. `city_chicago`) while public
 * routes pass the city `slug` (e.g. `chicago`). Mirror the id convention used
 * by the seed stores so create and list agree.
 */
function cityIdFromSlug(citySlug: string) {
  return `city_${citySlug.replaceAll("-", "_")}`;
}

async function requestBody(request: NextRequest): Promise<AdminMutationBody> {
  return (await request.json()) as AdminMutationBody;
}

function requireEntity(entity: AdminMutationBody["entity"]): RefreshEntity {
  if (!entity) {
    throw new Error("admin entity is required");
  }
  return entity;
}

function requireId(id: AdminMutationBody["id"]) {
  if (!id) {
    throw new Error("record id is required");
  }
  return id;
}

function requireInput<T>(input: unknown): T {
  if (!input || typeof input !== "object") {
    throw new Error("record input is required");
  }
  return input as T;
}

export async function GET(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  const citySlug = request.nextUrl.searchParams.get("city") ?? "chicago";
  const cityId = cityIdFromSlug(citySlug);
  const store = getRefreshStore();

  const [owners, targets] = await Promise.all([
    store.listSourceOwners(cityId),
    store.listSourceTargets(cityId),
  ]);
  const healthEntries = await Promise.all(
    targets.map(async (target) => [
      target.id,
      deriveSourceTargetHealth(
        await store.listSourceTargetOutcomes(target.id),
      ),
    ] as const),
  );

  return NextResponse.json(
    { owners, targets, healthByTarget: Object.fromEntries(healthEntries) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  try {
    const body = await requestBody(request);
    const store = getRefreshStore();

    switch (requireEntity(body.entity)) {
      case "sourceOwner": {
        const owner = await createSourceOwner(
          store,
          requireInput<CreateSourceOwnerInput>(body.input),
        );
        return NextResponse.json({ owner }, { status: 201 });
      }
      case "sourceTarget": {
        const target = await createSourceTarget(
          store,
          requireInput<CreateSourceTargetInput>(body.input),
        );
        return NextResponse.json({ target }, { status: 201 });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  try {
    const body = await requestBody(request);
    const store = getRefreshStore();
    const id = requireId(body.id);

    switch (requireEntity(body.entity)) {
      case "sourceOwner": {
        const owner = await updateSourceOwner(
          store,
          id,
          requireInput<UpdateSourceOwnerInput>(body.input),
        );
        return NextResponse.json({ owner });
      }
      case "sourceTarget": {
        const target = await updateSourceTarget(
          store,
          id,
          requireInput<UpdateSourceTargetInput>(body.input),
        );
        return NextResponse.json({ target });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const protection = adminProtectionResponse(request);
  if (protection) {
    return protection;
  }

  try {
    const body = await requestBody(request);
    const store = getRefreshStore();
    const id = requireId(body.id);

    switch (requireEntity(body.entity)) {
      case "sourceOwner":
        await deleteSourceOwner(store, id);
        return NextResponse.json({ ok: true });
      case "sourceTarget":
        await deleteSourceTarget(store, id);
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
