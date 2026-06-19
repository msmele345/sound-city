import {
  getCatalogStore,
  type CatalogStore,
} from "../catalog/catalog-store";
import { createDrizzleCatalogStore } from "../catalog/drizzle-catalog-store";
import { createDb } from "../db/client";
import { createDrizzleRefreshStore } from "./drizzle-refresh-store";
import { getRefreshStore, type RefreshStore } from "./refresh-store";

export type ReviewStoreBundle = {
  refreshStore: RefreshStore;
  catalogStore: CatalogStore;
  withTransaction<T>(
    callback: (
      refreshStore: RefreshStore,
      catalogStore: CatalogStore,
    ) => Promise<T>,
  ): Promise<T>;
};

export function createReviewStoreBundle(
  db: ReturnType<typeof createDb>,
): ReviewStoreBundle {
  return {
    refreshStore: createDrizzleRefreshStore(db),
    catalogStore: createDrizzleCatalogStore(db),
    withTransaction(callback) {
      return db.transaction(async (tx) =>
        callback(
          createDrizzleRefreshStore(tx),
          createDrizzleCatalogStore(tx),
        ),
      );
    },
  };
}

let databaseBundle: ReviewStoreBundle | null = null;

export function getReviewStoreBundle(): ReviewStoreBundle {
  if (process.env.DATABASE_URL) {
    databaseBundle ??= createReviewStoreBundle(createDb());
    return databaseBundle;
  }

  const refreshStore = getRefreshStore();
  const catalogStore = getCatalogStore();
  return {
    refreshStore,
    catalogStore,
    withTransaction(callback) {
      return refreshStore.withTransaction((txStore) =>
        callback(txStore, catalogStore),
      );
    },
  };
}
