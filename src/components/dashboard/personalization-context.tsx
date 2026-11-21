"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useCatalogData } from "./catalog-context";
import { usePersonalization } from "./use-personalization";

type PersonalizationValue = ReturnType<typeof usePersonalization>;

const PersonalizationContext = createContext<PersonalizationValue | null>(null);

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const { feed } = useCatalogData();
  const personalization = usePersonalization(
    feed.status === "ready" ? feed.events : undefined,
  );
  return (
    <PersonalizationContext.Provider value={personalization}>
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalizationData() {
  const value = useContext(PersonalizationContext);
  if (!value) {
    throw new Error("Personalization is only available inside the public layout");
  }
  return value;
}
