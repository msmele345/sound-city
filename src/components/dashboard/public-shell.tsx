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
];

function ManifestReadout({ align = "start" }: { align?: "start" | "end" }) {
  return (
    <div className={align === "end" ? "shrink-0 lg:text-right" : "shrink-0"}>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-faint">
        CHI&middot;HT / VOL.01
      </p>
      <dl className={`mt-3 flex gap-6 ${align === "end" ? "lg:justify-end" : ""}`}>
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
  );
}

function LargeMasthead() {
  return (
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
        <ManifestReadout align="end" />
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
  );
}

function CompactMasthead() {
  return (
    <header className="rise border-b-2 border-rule-strong pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-4xl uppercase leading-none tracking-[0.005em] text-ink sm:text-5xl">
            Sound City
          </h1>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-signal">
            Chicago / House + Techno
          </p>
        </div>
        <dl className="flex gap-5">
          {manifest.map((item) => (
            <div key={item.label}>
              <dd className="font-mono text-xl font-semibold tabular-nums leading-none text-ink">
                {item.value}
              </dd>
              <dt className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
                {item.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

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
          {pathname === "/" ? <LargeMasthead /> : <CompactMasthead />}

          <nav
            aria-label="Primary navigation"
            className="sticky top-0 z-30 mt-6 border-b border-rule bg-bg"
          >
            <div
              className="rise grid grid-cols-2 font-mono text-xs uppercase tracking-[0.2em] sm:flex sm:flex-wrap sm:items-stretch"
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
            </div>
          </nav>

          <main className="mt-10 min-w-0">{children}</main>

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
            <span>Source-verified &middot; Chicago underground</span>
            <a href="/admin" className="transition-colors duration-150 hover:text-ink">
              Admin
            </a>
            <span>End of manifest</span>
          </footer>
          </div>
        </StyleFilterProvider>
      </PersonalizationProvider>
    </CatalogProvider>
  );
}
