import { Suspense } from "react";

import { EventsView } from "@/components/dashboard/events-view";

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <p className="border-b border-rule py-5 font-mono text-label uppercase tracking-[0.12em] text-ink-dim">
          Loading Chicago event feed
        </p>
      }
    >
      <EventsView />
    </Suspense>
  );
}
