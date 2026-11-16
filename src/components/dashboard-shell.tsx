"use client";

import { HomeView } from "./dashboard/home-view";
import { PublicShell } from "./dashboard/public-shell";

export function DashboardShell() {
  return (
    <PublicShell>
      <HomeView />
    </PublicShell>
  );
}
