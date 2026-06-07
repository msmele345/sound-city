import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { createSeedRefreshStore } from "../store";
import {
  createSourceOwner,
  createSourceTarget,
  deleteSourceOwner,
  updateSourceTarget,
} from "../operations";
import type { RefreshStore } from "../refresh-store";
import type {
  CreateSourceOwnerInput,
  CreateSourceTargetInput,
} from "../types";

function ownerInput(
  overrides: Partial<CreateSourceOwnerInput> = {},
): CreateSourceOwnerInput {
  return {
    cityId: "city_chicago",
    name: "smartbar",
    slug: "smartbar",
    kind: "venue",
    notes: "",
    ...overrides,
  };
}

function targetInput(
  ownerId: string,
  overrides: Partial<CreateSourceTargetInput> = {},
): CreateSourceTargetInput {
  return {
    ownerId,
    cityId: "city_chicago",
    url: "https://smartbarchicago.com/calendar",
    sourceType: "official-venue-calendar",
    parserStrategy: "venue-calendar",
    trustLevel: "primary",
    enabled: true,
    confidenceAdjustment: 0,
    healthStatus: "healthy",
    refreshCadence: "daily",
    notes: "",
    ...overrides,
  };
}

describe("source owner operations", () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createSeedRefreshStore();
  });

  it("creates an owner and derives a slug from the name when omitted", async () => {
    const owner = await createSourceOwner(
      store,
      ownerProvidedWithoutSlug(),
    );

    expect(owner.slug).toBe("podlasie-club");
  });

  it("rejects an owner with a blank name", async () => {
    await expect(
      createSourceOwner(store, ownerInput({ name: "  " })),
    ).rejects.toThrow(/name is required/i);
  });

  it("rejects an invalid owner kind", async () => {
    await expect(
      createSourceOwner(
        store,
        ownerInput({ kind: "nonsense" as CreateSourceOwnerInput["kind"] }),
      ),
    ).rejects.toThrow(/kind is invalid/i);
  });

  it("refuses to delete an owner that still has targets", async () => {
    const owner = await createSourceOwner(store, ownerInput());
    await createSourceTarget(store, targetInput(owner.id));

    await expect(deleteSourceOwner(store, owner.id)).rejects.toThrow(
      /still has source targets/i,
    );
  });

  it("deletes an owner with no targets", async () => {
    const owner = await createSourceOwner(store, ownerInput());

    await expect(deleteSourceOwner(store, owner.id)).resolves.toBeUndefined();
    expect(await store.getSourceOwner(owner.id)).toBeNull();
  });

  function ownerProvidedWithoutSlug(): CreateSourceOwnerInput {
    return ownerInput({
      name: "Podlasie Club",
      slug: "",
    });
  }
});

describe("source target operations", () => {
  let store: RefreshStore;
  let ownerId: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    store = createSeedRefreshStore();
    const owner = await createSourceOwner(store, ownerInput());
    ownerId = owner.id;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a target for an existing owner", async () => {
    const target = await createSourceTarget(store, targetInput(ownerId));

    expect(target.ownerId).toBe(ownerId);
    expect(target.parserStrategy).toBe("venue-calendar");
  });

  it("rejects a target for a missing owner", async () => {
    await expect(
      createSourceTarget(store, targetInput("source_owner_ghost")),
    ).rejects.toThrow(/owner not found/i);
  });

  it("rejects a target with an invalid URL", async () => {
    await expect(
      createSourceTarget(store, targetInput(ownerId, { url: "not-a-url" })),
    ).rejects.toThrow(/valid url/i);
  });

  it("rejects an invalid source type", async () => {
    await expect(
      createSourceTarget(
        store,
        targetInput(ownerId, {
          sourceType: "bogus" as CreateSourceTargetInput["sourceType"],
        }),
      ),
    ).rejects.toThrow(/source type is invalid/i);
  });

  it("rejects the dev-static parser strategy in production", async () => {
    process.env.VERCEL_ENV = "production";

    await expect(
      createSourceTarget(
        store,
        targetInput(ownerId, { parserStrategy: "dev-static" }),
      ),
    ).rejects.toThrow(/dev-static parser strategy is not allowed in production/i);
  });

  it("allows the dev-static parser strategy outside production", async () => {
    delete process.env.VERCEL_ENV;

    const target = await createSourceTarget(
      store,
      targetInput(ownerId, { parserStrategy: "dev-static" }),
    );

    expect(target.parserStrategy).toBe("dev-static");
  });

  it("validates URL on update", async () => {
    const target = await createSourceTarget(store, targetInput(ownerId));

    await expect(
      updateSourceTarget(store, target.id, { url: "still-not-a-url" }),
    ).rejects.toThrow(/valid url/i);
  });

  it("toggles enabled state on update", async () => {
    const target = await createSourceTarget(store, targetInput(ownerId));

    const disabled = await updateSourceTarget(store, target.id, {
      enabled: false,
    });
    expect(disabled.enabled).toBe(false);
  });
});
