"use client";

import { useMemo } from "react";

import { ArtistShowcase } from "./artist-showcase";
import { ArtistStyleMatches } from "./artist-style-matches";
import { useCatalogData } from "./catalog-context";
import { SectionMark } from "./section-mark";
import { StyleFilterControl, styleFilterOptions } from "./style-filter-control";
import { useStyleFilter } from "./style-filter-context";

export function ArtistsView() {
  const { activeStyle, setActiveStyle } = useStyleFilter();
  const { feed, showcase, artistDirectory, retryShowcase, retryArtists } =
    useCatalogData();
  const styles = useMemo(
    () => styleFilterOptions(feed.events),
    [feed.events],
  );

  return (
    <section
      id="artists"
      aria-labelledby="artists-showcase-heading"
      className="min-w-0 scroll-mt-6"
    >
      <SectionMark
        id="artists-showcase-heading"
        title="Artist Showcase"
        index="Feature / 04"
      />
      {feed.status === "ready" && feed.events.length > 0 ? (
        <StyleFilterControl
          styles={styles}
          activeStyle={activeStyle}
          onStyleChange={setActiveStyle}
        />
      ) : null}
      <ArtistShowcase
        showcase={showcase}
        feed={feed}
        activeStyle={activeStyle}
        onRetry={retryShowcase}
      />
      <ArtistStyleMatches
        directory={artistDirectory}
        activeStyle={activeStyle}
        excludeArtistId={
          showcase.status === "ready" ? showcase.artist?.id : undefined
        }
        onRetry={retryArtists}
      />
    </section>
  );
}
