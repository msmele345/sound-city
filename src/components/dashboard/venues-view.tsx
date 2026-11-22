"use client";

import { useCatalogData } from "./catalog-context";
import { SectionMark } from "./section-mark";
import { VenueDirectory } from "./venue-directory";

export function VenuesView() {
  const { feed, venueDirectory, retryVenues } = useCatalogData();

  return (
    <section
      id="venues"
      aria-labelledby="venue-heading"
      className="min-w-0 scroll-mt-24"
    >
      <SectionMark
        id="venue-heading"
        title="Venue Signals"
        index="Room context / 05"
      />
      <VenueDirectory directory={venueDirectory} feed={feed} onRetry={retryVenues} />
    </section>
  );
}
