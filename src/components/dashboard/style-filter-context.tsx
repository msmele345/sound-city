"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type StyleFilterValue = {
  activeStyle: string;
  setActiveStyle: (style: string) => void;
};

const StyleFilterContext = createContext<StyleFilterValue | null>(null);

export function StyleFilterProvider({ children }: { children: ReactNode }) {
  const [activeStyle, setActiveStyle] = useState("all");
  return (
    <StyleFilterContext.Provider value={{ activeStyle, setActiveStyle }}>
      {children}
    </StyleFilterContext.Provider>
  );
}

export function useStyleFilter() {
  const value = useContext(StyleFilterContext);
  if (!value) {
    throw new Error("Style filter is only available inside the public layout");
  }
  return value;
}
