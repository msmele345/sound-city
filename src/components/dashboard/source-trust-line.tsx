import { formatVerifiedDate } from "./format";
import type { CatalogSource } from "./types";

export function SourceTrustLine({ source }: { source: CatalogSource }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-meta uppercase tracking-[0.14em]">
      <span className="text-ink-faint">
        Verified {formatVerifiedDate(source.lastVerifiedAt)}
      </span>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
      >
        {source.title}
      </a>
    </div>
  );
}
