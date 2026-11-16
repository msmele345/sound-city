import { Suspense, type ReactNode } from "react";

import { PublicShell } from "@/components/dashboard/public-shell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="border-b border-rule py-5 font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
          Loading view
        </p>
      }
    >
      <PublicShell>{children}</PublicShell>
    </Suspense>
  );
}
