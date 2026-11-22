import { Suspense } from "react";

import { EventsView } from "@/components/dashboard/events-view";
import { LoadingRows } from "@/components/dashboard/loading-rows";

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <LoadingRows label="Loading Chicago event feed" variant="feed" />
      }
    >
      <EventsView />
    </Suspense>
  );
}
