"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

type StyleFilterValue = {
  activeStyle: string;
  setActiveStyle: (style: string) => void;
};

const StyleFilterContext = createContext<StyleFilterValue | null>(null);

export function StyleFilterProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const style = searchParams.get("style");
  const activeStyle = style && style !== "all" ? style : "all";

  function setActiveStyle(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("style");
    } else {
      params.set("style", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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
