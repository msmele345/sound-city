"use client";

import { useState } from "react";

import { EventDiscoveryFeed } from "./dashboard/event-discovery-feed";
import {
  formatEventDate,
  formatEventTime,
  formatSignalCategory,
} from "./dashboard/format";
import { RecommendedEvents } from "./dashboard/recommended-events";
import { SectionMark } from "./dashboard/section-mark";
import { SourceTrustLine } from "./dashboard/source-trust-line";
import { useCatalog } from "./dashboard/use-catalog";
import { usePersonalization } from "./dashboard/use-personalization";
import type {
  ArtistDirectoryState,
  EventFeedState,
  ShowcaseState,
  VenueDirectoryState,
} from "./dashboard/types";

const manifest = [
  { value: "24", label: "Verified" },
  { value: "09", label: "Neighborhoods" },
  { value: "07", label: "Underground" },
];

const nav = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Events", href: "#events" },
  { label: "Artists", href: "#artists" },
  { label: "Venues", href: "#venues" },
  { label: "Admin", href: "/admin" },
];

function ArtistShowcase({
  showcase,
  feed,
  activeStyle,
}: {
  showcase: ShowcaseState;
  feed: EventFeedState;
  activeStyle: string;
}) {
  if (showcase.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading weekly artist showcase
      </p>
    );
  }

  if (showcase.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        Artist showcase is unavailable. Curated listening links will return
        here.
      </p>
    );
  }

  if (!showcase.artist) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No weekly artist showcase is selected yet.
      </p>
    );
  }

  if (
    activeStyle !== "all" &&
    !showcase.artist.styles.includes(activeStyle)
  ) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No featured artist matches {activeStyle}.
      </p>
    );
  }

  const artist = showcase.artist;
  const upcomingEvents =
    feed.status === "ready"
      ? feed.events.filter((event) =>
          event.artists.some(
            (eventArtist) =>
              eventArtist.slug === artist.slug || eventArtist.name === artist.name,
          ),
        )
      : [];

  return (
    <div className="mt-5">
      <div
        aria-hidden
        className="h-1.5 border-b border-rule"
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--color-signal) 0 10px, transparent 10px 20px)",
        }}
      />
      <div className="border-b border-rule py-5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-signal">
          Weekly feature
        </p>
        <h3 className="mt-3 font-display text-5xl uppercase leading-[0.85] text-ink">
          {artist.name}
        </h3>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
          {artist.styles.join(" / ")}
        </p>
        <p className="mt-5 text-sm leading-relaxed text-ink-dim">
          {artist.bio}
        </p>
        {artist.links.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {artist.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-b border-rule py-5">
        <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
          Upcoming shows
        </h4>
        {feed.status === "loading" ? (
          <p className="mt-3 text-sm text-ink-dim">
            Waiting on verified event feed.
          </p>
        ) : upcomingEvents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-dim">
            No upcoming Chicago dates are attached to this artist yet.
          </p>
        ) : (
          <ol className="mt-2">
            {upcomingEvents.map((event) => (
              <li key={event.id} className="border-t border-rule py-3">
                <h5 className="font-display text-xl uppercase leading-none text-ink">
                  {event.title}
                </h5>
                <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
                  {formatEventDate(event.startsAt)}
                  <span className="text-ink-faint"> / </span>
                  {formatEventTime(event.startsAt)}
                  <span className="text-ink-faint"> / </span>
                  {event.venue.name}
                </p>
                <SourceTrustLine source={event.source} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function ArtistStyleMatches({
  directory,
  activeStyle,
  excludeArtistId,
}: {
  directory: ArtistDirectoryState;
  activeStyle: string;
  excludeArtistId?: string;
}) {
  if (activeStyle === "all") return null;

  if (directory.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading artist style matches
      </p>
    );
  }

  if (directory.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        Artist style matches are unavailable.
      </p>
    );
  }

  const artists = directory.artists.filter(
    (artist) =>
      artist.styles.includes(activeStyle) && artist.id !== excludeArtistId,
  );

  return (
    <div className="border-b border-rule py-5">
      <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
        Artists tagged {activeStyle}
      </h4>
      {artists.length === 0 ? (
        <p className="mt-3 text-sm text-ink-dim">
          No verified artists match that style.
        </p>
      ) : (
        <ol className="mt-2">
          {artists.map((artist) => (
            <li key={artist.id} className="border-t border-rule py-3">
              <h5 className="font-display text-xl uppercase leading-none text-ink">
                {artist.name}
              </h5>
              <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
                {artist.styles.join(" / ")}
              </p>
              <SourceTrustLine source={artist.source} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VenueDirectory({
  directory,
  feed,
}: {
  directory: VenueDirectoryState;
  feed: EventFeedState;
}) {
  if (directory.status === "loading") {
    return (
      <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
        Loading venue directory
      </p>
    );
  }

  if (directory.status === "error") {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        Venue signals are unavailable. Curated room context will return here.
      </p>
    );
  }

  if (directory.venues.length === 0) {
    return (
      <p className="border-b border-rule py-5 text-sm text-ink-dim">
        No Chicago venues are verified yet.
      </p>
    );
  }

  return (
    <ol className="mt-1">
      {directory.venues.map((venue, i) => {
        const upcomingEvents =
          feed.status === "ready"
            ? feed.events.filter(
                (event) =>
                  event.venue.slug === venue.slug ||
                  event.venue.name === venue.name,
              )
            : [];

        return (
          <li key={venue.id} className="border-b border-rule py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-3xl uppercase leading-none text-ink">
                {venue.name}
              </h3>
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
              {venue.neighborhood}
              {venue.capacity ? (
                <>
                  <span className="text-ink-faint"> / </span>
                  {venue.capacity} cap
                </>
              ) : null}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">
              {venue.address}
            </p>

            {venue.signals.length > 0 ? (
              <dl className="mt-4">
                {venue.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="grid gap-2 border-t border-rule py-3 font-mono text-xs sm:grid-cols-[5rem_1fr]"
                  >
                    <dt className="uppercase tracking-[0.16em] text-ink-faint">
                      {formatSignalCategory(signal.category)}
                    </dt>
                    <dd className="uppercase tracking-[0.05em] text-ink-dim">
                      {signal.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-4 border-t border-rule pt-4">
              <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
                Upcoming events
              </h4>
              {feed.status === "loading" ? (
                <p className="mt-3 text-sm text-ink-dim">
                  Waiting on verified event feed.
                </p>
              ) : upcomingEvents.length === 0 ? (
                <p className="mt-3 text-sm text-ink-dim">
                  No upcoming events are attached to this venue yet.
                </p>
              ) : (
                <ol className="mt-2">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="border-t border-rule py-3">
                      <h4 className="font-display text-xl uppercase leading-none text-ink">
                        {event.title}
                      </h4>
                      <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-ink-faint">
                        {formatEventDate(event.startsAt)}
                        <span className="text-ink-faint"> / </span>
                        {formatEventTime(event.startsAt)}
                      </p>
                      <SourceTrustLine source={event.source} />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <a
              href={venue.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              {venue.source.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function DashboardShell() {
  const [activeStyle, setActiveStyle] = useState("all");
  const { feed, showcase, artistDirectory, venueDirectory } = useCatalog();
  const { profile, actions, setProfile, setActions } = usePersonalization();

  return (
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
        {nav.map((item, i) => (
          <a
            key={item.label}
            href={item.href}
            aria-disabled={item.href ? undefined : "true"}
            aria-current={i === 0 ? "page" : undefined}
            className={`min-w-0 border-r border-rule px-3 py-3 transition-colors duration-150 hover:bg-panel hover:text-signal sm:px-4 ${
              i === 0
                ? "bg-panel text-signal"
                : item.href
                  ? "text-ink-dim"
                  : "cursor-not-allowed text-ink-faint"
            }`}
          >
            <span className="text-ink-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
            {item.label}
          </a>
        ))}
      </nav>

      <main className="mt-10 grid min-w-0 gap-x-12 gap-y-12 lg:grid-cols-[1.65fr_0.7fr]">
        <div className="flex min-w-0 flex-col gap-12">
          <section
            id="recommendations"
            aria-labelledby="recommended-heading"
            className="min-w-0 scroll-mt-6"
          >
            <SectionMark
              id="recommended-heading"
              title="Recommended Tonight"
              index="Discovery queue / 02"
            />
            <RecommendedEvents
              feed={feed}
              profile={profile}
              actions={actions}
              onProfileChange={setProfile}
              onActionsChange={setActions}
            />
          </section>

          <section id="events" aria-labelledby="latest-heading" className="min-w-0 scroll-mt-6">
            <SectionMark
              id="latest-heading"
              title="Latest Events"
              index="Source verified / 03"
            />
            <EventDiscoveryFeed
              feed={feed}
              activeStyle={activeStyle}
              onStyleChange={setActiveStyle}
            />
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-12 lg:border-l-2 lg:border-rule-strong lg:pl-12">
          <section id="artists" aria-labelledby="showcase-heading" className="min-w-0 scroll-mt-6">
            <SectionMark
              id="showcase-heading"
              title="Artist Showcase"
              index="Feature / 04"
            />
            <ArtistShowcase
              showcase={showcase}
              feed={feed}
              activeStyle={activeStyle}
            />
            <ArtistStyleMatches
              directory={artistDirectory}
              activeStyle={activeStyle}
              excludeArtistId={
                showcase.status === "ready" ? showcase.artist?.id : undefined
              }
            />
          </section>

          <section id="venues" aria-labelledby="venue-heading" className="min-w-0 scroll-mt-6">
            <SectionMark
              id="venue-heading"
              title="Venue Signals"
              index="Room context / 05"
            />
            <VenueDirectory directory={venueDirectory} feed={feed} />
          </section>
        </aside>
      </main>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
        <span>Source-verified &middot; Chicago underground</span>
        <span>End of manifest</span>
      </footer>
    </div>
  );
}
