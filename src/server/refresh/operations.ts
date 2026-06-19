import { slugFromText } from "../slug";
import type { RefreshStore } from "./refresh-store";
import type {
  CreateSourceOwnerInput,
  CreateSourceTargetInput,
  HealthStatus,
  ParserStrategy,
  SourceOwnerRecord,
  SourceTargetRecord,
  SourceType,
  TrustLevel,
  UpdateSourceOwnerInput,
  UpdateSourceTargetInput,
} from "./types";

// ─── Validation helpers ───────────────────────────────────────────

function assertPresent(value: string | undefined, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function assertUrl(value: string) {
  try {
    new URL(value);
  } catch {
    throw new Error("source target URL must be a valid URL");
  }
}

const sourceOwnerKinds = new Set<SourceOwnerRecord["kind"]>([
  "listing-platform",
  "venue",
  "artist",
  "promoter",
  "ticketing",
]);

const sourceTypes = new Set<SourceType>([
  "resident-advisor",
  "official-venue-calendar",
  "artist-social",
  "ticketing",
  "other",
]);

const parserStrategies = new Set<ParserStrategy>([
  "venue-calendar",
  "rss-event-feed",
  "artist-social",
  "resident-advisor",
  "dev-static",
]);

const trustLevels = new Set<TrustLevel>([
  "primary",
  "supporting",
  "experimental",
]);

const healthStatuses = new Set<HealthStatus>([
  "healthy",
  "degraded",
  "failing",
  "disabled",
]);

function assertOwnerKind(kind: SourceOwnerRecord["kind"]) {
  if (!sourceOwnerKinds.has(kind)) {
    throw new Error("source owner kind is invalid");
  }
}

function assertSourceType(sourceType: SourceType) {
  if (!sourceTypes.has(sourceType)) {
    throw new Error("source type is invalid");
  }
}

function assertTrustLevel(trustLevel: TrustLevel) {
  if (!trustLevels.has(trustLevel)) {
    throw new Error("trust level is invalid");
  }
}

function assertHealthStatus(healthStatus: HealthStatus) {
  if (!healthStatuses.has(healthStatus)) {
    throw new Error("health status is invalid");
  }
}

/**
 * The `dev-static` fixture parser must never run outside local/test. Gate on
 * `VERCEL_ENV` rather than `NODE_ENV` so Vercel preview deployments (which run
 * with `NODE_ENV=production`) can still demo the fixture workflow.
 */
export function validateParserStrategy(strategy: ParserStrategy): void {
  if (!parserStrategies.has(strategy)) {
    throw new Error("parser strategy is invalid");
  }
  if (strategy === "dev-static" && process.env.VERCEL_ENV === "production") {
    throw new Error("dev-static parser strategy is not allowed in production");
  }
}

// ─── Source Owner operations ──────────────────────────────────────

export async function createSourceOwner(
  store: RefreshStore,
  input: CreateSourceOwnerInput,
): Promise<SourceOwnerRecord> {
  assertPresent(input.cityId, "city id");
  assertPresent(input.name, "source owner name");
  assertOwnerKind(input.kind);

  const slug = input.slug?.trim() ? input.slug.trim() : slugFromText(input.name);
  assertPresent(slug, "source owner slug");

  return store.createSourceOwner({
    ...input,
    slug,
    notes: input.notes ?? "",
  });
}

export async function updateSourceOwner(
  store: RefreshStore,
  id: string,
  input: UpdateSourceOwnerInput,
): Promise<SourceOwnerRecord> {
  if (input.name !== undefined) assertPresent(input.name, "source owner name");
  if (input.kind !== undefined) assertOwnerKind(input.kind);

  return store.updateSourceOwner(id, input);
}

export async function deleteSourceOwner(
  store: RefreshStore,
  id: string,
): Promise<void> {
  const owner = await store.getSourceOwner(id);
  if (!owner) {
    throw new Error("Source owner not found");
  }

  const targets = await store.listSourceTargets(owner.cityId);
  if (targets.some((target) => target.ownerId === id)) {
    throw new Error(
      "Cannot delete a source owner that still has source targets",
    );
  }

  await store.deleteSourceOwner(id);
}

// ─── Source Target operations ─────────────────────────────────────

export async function createSourceTarget(
  store: RefreshStore,
  input: CreateSourceTargetInput,
): Promise<SourceTargetRecord> {
  assertPresent(input.cityId, "city id");
  assertPresent(input.ownerId, "source owner");
  assertPresent(input.url, "source target URL");
  assertUrl(input.url);
  assertSourceType(input.sourceType);
  validateParserStrategy(input.parserStrategy);
  assertTrustLevel(input.trustLevel);
  assertHealthStatus(input.healthStatus);

  const owner = await store.getSourceOwner(input.ownerId);
  if (!owner) {
    throw new Error("Source owner not found");
  }

  return store.createSourceTarget({ ...input, notes: input.notes ?? "" });
}

export async function updateSourceTarget(
  store: RefreshStore,
  id: string,
  input: UpdateSourceTargetInput,
): Promise<SourceTargetRecord> {
  if (input.url !== undefined) {
    assertPresent(input.url, "source target URL");
    assertUrl(input.url);
  }
  if (input.sourceType !== undefined) assertSourceType(input.sourceType);
  if (input.parserStrategy !== undefined) {
    validateParserStrategy(input.parserStrategy);
  }
  if (input.trustLevel !== undefined) assertTrustLevel(input.trustLevel);
  if (input.healthStatus !== undefined) assertHealthStatus(input.healthStatus);

  return store.updateSourceTarget(id, input);
}

export async function deleteSourceTarget(
  store: RefreshStore,
  id: string,
): Promise<void> {
  await store.deleteSourceTarget(id);
}
