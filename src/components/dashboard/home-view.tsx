"use client";

import { ArtistShowcase } from "./artist-showcase";
import { useCatalogData } from "./catalog-context";
import { useEventActions } from "./event-actions";
import { NextUp } from "./next-up";
import { usePersonalizationData } from "./personalization-context";
import { RecommendedEvents } from "./recommended-events";
import { SectionMark } from "./section-mark";
import { useStyleFilter } from "./style-filter-context";

export function HomeView() {
  const { activeStyle } = useStyleFilter();
  const { feed, showcase, retryFeed, retryShowcase } = useCatalogData();
  const { profile, setProfile, resetProfile } = usePersonalizationData();
  const eventActions = useEventActions();

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
          actions={eventActions.actions}
          onProfileChange={setProfile}
          onReset={resetProfile}
          onToggleSaved={eventActions.save}
          onDismiss={eventActions.dismiss}
          onAttend={eventActions.attend}
          onRetry={retryFeed}
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
            onRetry={retryShowcase}
          />
        </section>

        <NextUp feed={feed} onRetry={retryFeed} />
      </aside>
    </div>
  );
}
