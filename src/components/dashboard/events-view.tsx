"use client";

import { useState } from "react";

import { useCatalogData } from "./catalog-context";
import { EventDiscoveryFeed } from "./event-discovery-feed";
import { SectionMark } from "./section-mark";

export function EventsView() {
  const [activeStyle, setActiveStyle] = useState("all");
  const { feed } = useCatalogData();

  return (
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
  );
}
