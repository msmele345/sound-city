import { describe, it, expect, beforeEach } from "vitest";
import { createSeedRefreshStore } from "../store";
import type { RefreshStore } from "../refresh-store";
import type { CreateSourceOwnerInput, SourceOwnerRecord } from "../types";

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

describe("source owner store", () => {
  let store: RefreshStore;

  beforeEach(() => {
    store = createSeedRefreshStore();
  });

  it("lists source owners for a city", async () => {
    const created = await store.createSourceOwner(makeOwner());

    const owners = await store.listSourceOwners("city_chicago");

    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(created.id);
    expect(owners[0].name).toBe("smartbar");
  });

  it("filters source owners by city", async () => {
    await store.createSourceOwner(makeOwner({ cityId: "city_chicago" }));
    await store.createSourceOwner(makeOwner({ cityId: "city_new_york", slug: "berghain", name: "Berghain" }));

    const chicagoOwners = await store.listSourceOwners("city_chicago");
    const nyOwners = await store.listSourceOwners("city_new_york");

    expect(chicagoOwners).toHaveLength(1);
    expect(nyOwners).toHaveLength(1);
  });

  it("gets a source owner by id", async () => {
    const created = await store.createSourceOwner(makeOwner());

    const found = await store.getSourceOwner(created.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe("smartbar");
  });

  it("returns null for missing source owner", async () => {
    const found = await store.getSourceOwner("nonexistent");

    expect(found).toBeNull();
  });

  it("updates a source owner", async () => {
    const created = await store.createSourceOwner(makeOwner());

    const updated = await store.updateSourceOwner(created.id, { name: "Smartbar Chicago" });

    expect(updated.name).toBe("Smartbar Chicago");
    const found = await store.getSourceOwner(created.id);
    expect(found!.name).toBe("Smartbar Chicago");
  });

  it("throws when updating a nonexistent source owner", async () => {
    await expect(
      store.updateSourceOwner("nonexistent", { name: "Nope" }),
    ).rejects.toThrow("Source owner not found");
  });

  it("deletes a source owner", async () => {
    const created = await store.createSourceOwner(makeOwner());

    await store.deleteSourceOwner(created.id);

    const found = await store.getSourceOwner(created.id);
    expect(found).toBeNull();
  });

  it("throws when deleting a nonexistent source owner", async () => {
    await expect(store.deleteSourceOwner("nonexistent")).rejects.toThrow(
      "Source owner not found",
    );
  });

  it("unsets city owners when all deleted", async () => {
    const created = await store.createSourceOwner(makeOwner());
    await store.deleteSourceOwner(created.id);

    const owners = await store.listSourceOwners("city_chicago");
    expect(owners).toHaveLength(0);
  });
});
