"use client";

import { useCatalogData } from "./catalog-context";
import { EventDiscoveryFeed } from "./event-discovery-feed";
import { SectionMark } from "./section-mark";
import { useStyleFilter } from "./style-filter-context";

export function EventsView() {
  const { activeStyle, setActiveStyle } = useStyleFilter();
  const { feed, retryFeed } = useCatalogData();

  return (
    <section id="events" aria-labelledby="latest-heading" className="min-w-0 scroll-mt-24">
      <SectionMark
        id="latest-heading"
        title="Latest Events"
        index="Source verified / 03"
      />
      <EventDiscoveryFeed
        feed={feed}
        activeStyle={activeStyle}
        onStyleChange={setActiveStyle}
        onRetry={retryFeed}
      />
    </section>
  );
}
