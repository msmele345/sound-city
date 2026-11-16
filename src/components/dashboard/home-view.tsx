"use client";

import { ArtistShowcase } from "./artist-showcase";
import { useCatalogData } from "./catalog-context";
import { NextUp } from "./next-up";
import { usePersonalizationData } from "./personalization-context";
import { RecommendedEvents } from "./recommended-events";
import { SectionMark } from "./section-mark";
import { useStyleFilter } from "./style-filter-context";

export function HomeView() {
  const { activeStyle } = useStyleFilter();
  const { feed, showcase } = useCatalogData();
  const { profile, actions, setProfile, setActions } = usePersonalizationData();

  return (
    <div className="grid min-w-0 gap-x-12 gap-y-12 lg:grid-cols-[1.65fr_0.7fr]">
      <section
        id="recommendations"
        aria-labelledby="recommended-heading"
        className="min-w-0 scroll-mt-6"
      >
        <SectionMark
          id="recommended-heading"
          title="For You"
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
        </section>

        <NextUp feed={feed} />
      </aside>
    </div>
  );
}
