"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CatalogProvider } from "./catalog-context";
import { PersonalizationProvider } from "./personalization-context";
import { StyleFilterProvider } from "./style-filter-context";

const manifest = [
  { value: "24", label: "Verified" },
  { value: "09", label: "Neighborhoods" },
  { value: "07", label: "Underground" },
];

const nav = [
  { label: "For You", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Artists", href: "/artists" },
  { label: "Venues", href: "/venues" },
  { label: "Admin", href: "/admin" },
];

function isCurrentPath(pathname: string, href: string) {
  if (!href || href.startsWith("#")) {
    return false;
  }
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <CatalogProvider>
      <PersonalizationProvider>
        <StyleFilterProvider>
          <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
          <header id="dashboard" className="rise scroll-mt-6 border-b-2 border-rule-strong pb-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.34em] text-signal">
                  Chicago / House + Techno
                </p>
                <h1 className="mt-3 font-display text-[clamp(3.5rem,13vw,8.5rem)] uppercase leading-[0.82] tracking-[0.005em] text-ink">
                  Sound City
                </h1>
              </div>
              <div className="shrink-0 lg:text-right">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-faint">
                  CHI&middot;HT / VOL.01
                </p>
                <dl className="mt-3 flex gap-6 lg:justify-end">
                  {manifest.map((item) => (
                    <div key={item.label}>
                      <dd className="font-mono text-2xl font-semibold tabular-nums text-ink">
                        {item.value}
                      </dd>
                      <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
                        {item.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            {/* Hazard-tape mark — one deliberate brand stripe, not decoration. */}
            <div
              aria-hidden
              className="mt-6 h-2"
              style={{
                background:
                  "repeating-linear-gradient(135deg, var(--color-signal) 0 14px, transparent 14px 28px)",
              }}
            />
          </header>

          <nav
            aria-label="Primary navigation"
            className="rise mt-6 grid grid-cols-2 border-b border-rule font-mono text-xs uppercase tracking-[0.2em] sm:flex sm:flex-wrap sm:items-stretch"
            style={{ animationDelay: "70ms" }}
          >
            {nav.map((item, i) => {
              const current = isCurrentPath(pathname, item.href);
              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-disabled={item.href ? undefined : "true"}
                  aria-current={current ? "page" : undefined}
                  className={`min-w-0 border-r border-rule px-3 py-3 transition-colors duration-150 hover:bg-panel hover:text-signal sm:px-4 ${
                    current
                      ? "bg-panel text-signal"
                      : item.href
                        ? "text-ink-dim"
                        : "cursor-not-allowed text-ink-faint"
                  }`}
                >
                  <span className="text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>{" "}
                  {item.label}
                </a>
              );
            })}
          </nav>

          <main className="mt-10 min-w-0">{children}</main>

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
            <span>Source-verified &middot; Chicago underground</span>
            <span>End of manifest</span>
          </footer>
          </div>
        </StyleFilterProvider>
      </PersonalizationProvider>
    </CatalogProvider>
  );
}
