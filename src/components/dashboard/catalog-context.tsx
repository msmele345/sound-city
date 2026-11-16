"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useCatalog } from "./use-catalog";

type CatalogValue = ReturnType<typeof useCatalog>;

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  return (
    <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
  );
}

export function useCatalogData() {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error("Catalog is only available inside the public layout");
  }
  return value;
}
