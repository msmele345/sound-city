"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, type ReactNode } from "react";

import { Button } from "./button";
import { CatalogProvider, useCatalogData } from "./catalog-context";
import {
  PersonalizationProvider,
  usePersonalizationData,
} from "./personalization-context";
import { StyleFilterProvider, useStyleFilter } from "./style-filter-context";

const nav = [
  { label: "For You", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Artists", href: "/artists" },
  { label: "Venues", href: "/venues" },
  { label: "Saved", href: "/saved" },
];

function catalogCounts(
  events: { length: number },
  venues: { neighborhood: string }[],
) {
  const neighborhoods = new Set(
    venues
      .map((venue) => venue.neighborhood.trim())
      .filter((neighborhood) => neighborhood.length > 0),
  );
  return [
    { value: String(events.length).padStart(2, "0"), label: "Events" },
    { value: String(venues.length).padStart(2, "0"), label: "Venues" },
    {
      value: String(neighborhoods.size).padStart(2, "0"),
      label: "Neighborhoods",
    },
  ];
}

function ManifestReadout({
  align = "start",
  compact = false,
}: {
  align?: "start" | "end";
  compact?: boolean;
}) {
  const { feed, venueDirectory } = useCatalogData();
  if (feed.status !== "ready" || venueDirectory.status !== "ready") {
    return null;
  }

  const counts = catalogCounts(feed.events, venueDirectory.venues);

  return (
    <div className={align === "end" ? "shrink-0 lg:text-right" : "shrink-0"}>
      {compact ? null : (
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-faint">
          CHI&middot;HT / VOL.01
        </p>
      )}
      <dl
        className={`flex gap-5 ${compact ? "" : "mt-3 gap-6"} ${
          align === "end" ? "lg:justify-end" : ""
        }`}
      >
        {counts.map((item) => (
          <div key={item.label}>
            <dd
              className={`font-mono font-semibold tabular-nums text-ink ${
                compact ? "text-xl leading-none" : "text-2xl"
              }`}
            >
              {item.value}
            </dd>
            <dt
              className={`font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint ${
                compact ? "mt-1" : ""
              }`}
            >
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
        <ManifestReadout compact />
      </div>
    </header>
  );
}

function ActionStatus() {
  const pathname = usePathname();
  const { notice, clearNotice } = usePersonalizationData();
  const seenPath = useRef(pathname);

  useEffect(() => {
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    clearNotice();
  }, [clearNotice, pathname]);

  return (
    <div
      role="status"
      className="font-mono text-xs uppercase tracking-[0.14em] text-ink"
    >
      {notice ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule py-3">
          <p>{notice.message}</p>
          {notice.undo ? (
            <Button variant="quiet" onClick={notice.undo}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isCurrentPath(pathname: string, href: string) {
  const path = href.split("?")[0] ?? href;
  if (!path || path.startsWith("#")) {
    return false;
  }
  if (path === "/") {
    return pathname === "/";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function hrefWithStyle(href: string, activeStyle: string) {
  if (
    activeStyle !== "all" &&
    (href === "/" || href === "/events" || href === "/artists")
  ) {
    const query = new URLSearchParams({ style: activeStyle }).toString();
    return href === "/" ? `/?${query}` : `${href}?${query}`;
  }
  return href;
}

function NavLinks({ activeStyle }: { activeStyle: string }) {
  const pathname = usePathname();
  const { actions } = usePersonalizationData();
  const savedCount = String(actions.savedEventIds.length).padStart(2, "0");

  return (
    <nav
      aria-label="Primary navigation"
      className="sticky top-0 z-30 mt-6 border-b border-rule bg-bg"
    >
      <div
        className="rise grid grid-cols-2 font-mono text-xs uppercase tracking-[0.2em] sm:flex sm:flex-wrap sm:items-stretch"
        style={{ animationDelay: "70ms" }}
      >
        {nav.map((item, i) => {
          const href = hrefWithStyle(item.href, activeStyle);
          const current = isCurrentPath(pathname, href);
          return (
            <Link
              key={item.label}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`min-w-0 border-r border-rule px-3 py-3 transition-colors duration-150 hover:bg-panel hover:text-signal sm:px-4 ${
                current ? "bg-panel text-signal" : "text-ink-dim"
              }`}
            >
              <span className="text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>{" "}
              {item.label}
              {item.href === "/saved" ? (
                <span aria-live="polite"> {savedCount}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function StyleAwareNav() {
  const { activeStyle } = useStyleFilter();
  return <NavLinks activeStyle={activeStyle} />;
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <CatalogProvider>
      <PersonalizationProvider>
        <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
          {pathname === "/" ? <LargeMasthead /> : <CompactMasthead />}

          <Suspense fallback={<NavLinks activeStyle="all" />}>
            <StyleFilterProvider>
              <StyleAwareNav />
            </StyleFilterProvider>
          </Suspense>

          <ActionStatus />

          <main className="mt-10 min-w-0">
            <Suspense
              fallback={
                <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
                  Loading view
                </p>
              }
            >
              <StyleFilterProvider>{children}</StyleFilterProvider>
            </Suspense>
          </main>

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
            <span>Source-verified &middot; Chicago underground</span>
            <a href="/admin" className="transition-colors duration-150 hover:text-ink">
              Admin
            </a>
            <span>End of manifest</span>
          </footer>
        </div>
      </PersonalizationProvider>
    </CatalogProvider>
  );
}
