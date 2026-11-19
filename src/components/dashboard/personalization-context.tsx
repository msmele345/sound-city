"use client";

import { createContext, useContext, type ReactNode } from "react";

import { usePersonalization } from "./use-personalization";

type PersonalizationValue = ReturnType<typeof usePersonalization>;

const PersonalizationContext = createContext<PersonalizationValue | null>(null);

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const personalization = usePersonalization();
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
