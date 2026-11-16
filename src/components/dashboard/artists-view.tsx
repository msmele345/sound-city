"use client";

import { ArtistShowcase } from "./artist-showcase";
import { ArtistStyleMatches } from "./artist-style-matches";
import { useCatalogData } from "./catalog-context";
import { SectionMark } from "./section-mark";
import { useStyleFilter } from "./style-filter-context";

export function ArtistsView() {
  const { activeStyle } = useStyleFilter();
  const { feed, showcase, artistDirectory } = useCatalogData();

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
  );
}
