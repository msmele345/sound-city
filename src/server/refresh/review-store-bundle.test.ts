import { describe, expect, it, vi } from "vitest";

const { createCatalogStore, createRefreshStore } = vi.hoisted(() => ({
  createCatalogStore: vi.fn((db: unknown) => ({ db })),
  createRefreshStore: vi.fn((db: unknown) => ({ db })),
}));

vi.mock("../catalog/drizzle-catalog-store", () => ({
  createDrizzleCatalogStore: createCatalogStore,
}));

vi.mock("./drizzle-refresh-store", () => ({
  createDrizzleRefreshStore: createRefreshStore,
}));

import { createReviewStoreBundle } from "./review-store-bundle";

describe("review store bundle", () => {
  it("runs refresh and catalog approval work on the same transaction", async () => {
    const transaction = { kind: "transaction" };
    const db = {
      async transaction<T>(callback: (tx: unknown) => Promise<T>) {
        return callback(transaction);
      },
    };
    const bundle = createReviewStoreBundle(
      db as Parameters<typeof createReviewStoreBundle>[0],
    );

    const result = await bundle.withTransaction(
      async (refreshStore, catalogStore) => {
        expect(refreshStore).toEqual({ db: transaction });
        expect(catalogStore).toEqual({ db: transaction });
        return "committed";
      },
    );

    expect(result).toBe("committed");
    expect(createRefreshStore).toHaveBeenLastCalledWith(transaction);
    expect(createCatalogStore).toHaveBeenLastCalledWith(transaction);
  });
});
