"use client";

import { useState } from "react";

import { ArtistShowcase } from "./artist-showcase";
import { ArtistStyleMatches } from "./artist-style-matches";
import { useCatalogData } from "./catalog-context";
import { EventDiscoveryFeed } from "./event-discovery-feed";
import { usePersonalizationData } from "./personalization-context";
import { RecommendedEvents } from "./recommended-events";
import { SectionMark } from "./section-mark";
import { VenueDirectory } from "./venue-directory";

export function HomeView() {
  const [activeStyle, setActiveStyle] = useState("all");
  const { feed, showcase, artistDirectory, venueDirectory } = useCatalogData();
  const { profile, actions, setProfile, setActions } = usePersonalizationData();

  return (
    <div className="grid min-w-0 gap-x-12 gap-y-12 lg:grid-cols-[1.65fr_0.7fr]">
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
    </div>
  );
}
