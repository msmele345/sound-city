import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { CreateSourceTargetInput, CreateSourceOwnerInput } from "../types";

function makeOwner(
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

function makeTarget(
  overrides: Partial<CreateSourceTargetInput> = {},
): CreateSourceTargetInput {
  return {
    ownerId: "source_owner_smartbar",
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

describe("source target store", () => {
  let store: RefreshStore;

  beforeEach(async () => {
    store = createSeedRefreshStore();
    await store.createSourceOwner(makeOwner());
  });

  it("creates and lists source targets for a city", async () => {
    const created = await store.createSourceTarget(makeTarget());

    const targets = await store.listSourceTargets("city_chicago");

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe(created.id);
    expect(targets[0].url).toBe("https://smartbarchicago.com/calendar");
    expect(targets[0].parserStrategy).toBe("venue-calendar");
  });

  it("filters source targets by city", async () => {
    await store.createSourceTarget(makeTarget());
    await store.createSourceTarget(
      makeTarget({ cityId: "city_new_york", url: "https://berghain.com" }),
    );

    const chicago = await store.listSourceTargets("city_chicago");
    const ny = await store.listSourceTargets("city_new_york");

    expect(chicago).toHaveLength(1);
    expect(ny).toHaveLength(1);
  });

  it("gets a source target by id", async () => {
    const created = await store.createSourceTarget(makeTarget());

    const found = await store.getSourceTarget(created.id);

    expect(found).not.toBeNull();
    expect(found!.url).toBe("https://smartbarchicago.com/calendar");
  });

  it("returns null for missing source target", async () => {
    const found = await store.getSourceTarget("nonexistent");
    expect(found).toBeNull();
  });

  it("updates a source target", async () => {
    const created = await store.createSourceTarget(makeTarget());

    const updated = await store.updateSourceTarget(created.id, {
      url: "https://smartbarchicago.com/new-calendar",
    });

    expect(updated.url).toBe("https://smartbarchicago.com/new-calendar");
    const found = await store.getSourceTarget(created.id);
    expect(found!.url).toBe("https://smartbarchicago.com/new-calendar");
  });

  it("enables and disables a source target", async () => {
    const created = await store.createSourceTarget(makeTarget());

    await store.updateSourceTarget(created.id, { enabled: false });
    let found = await store.getSourceTarget(created.id);
    expect(found!.enabled).toBe(false);

    await store.updateSourceTarget(created.id, { enabled: true });
    found = await store.getSourceTarget(created.id);
    expect(found!.enabled).toBe(true);
  });

  it("updates health status", async () => {
    const created = await store.createSourceTarget(makeTarget());

    await store.updateSourceTarget(created.id, { healthStatus: "degraded" });
    const found = await store.getSourceTarget(created.id);
    expect(found!.healthStatus).toBe("degraded");
  });

  it("throws when updating a nonexistent source target", async () => {
    await expect(
      store.updateSourceTarget("nonexistent", { url: "nope" }),
    ).rejects.toThrow("Source target not found");
  });

  it("deletes a source target", async () => {
    const created = await store.createSourceTarget(makeTarget());

    await store.deleteSourceTarget(created.id);

    const found = await store.getSourceTarget(created.id);
    expect(found).toBeNull();
  });

  it("throws when deleting a nonexistent source target", async () => {
    await expect(store.deleteSourceTarget("nonexistent")).rejects.toThrow(
      "Source target not found",
    );
  });

  it("returns empty list when no targets exist for city", async () => {
    const targets = await store.listSourceTargets("city_chicago");
    expect(targets).toHaveLength(0);
  });
});
