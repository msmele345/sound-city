import { isHttpUrl } from "@/lib/http-url";

import { formatSourceDisplayName, formatVerifiedTrustDate } from "./format";
import type { CatalogSource } from "./types";

export function SourceTrustLine({ source }: { source: CatalogSource }) {
  const verifiedOn = formatVerifiedTrustDate(source.lastVerifiedAt);
  const sourceName = formatSourceDisplayName(source.title, source.url);

  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-faint">
        Verified {verifiedOn}
      </span>
      {sourceName ? (
        <>
          <span aria-hidden className="font-mono text-meta text-ink-faint">
            ·
          </span>
          {isHttpUrl(source.url) ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="font-sans text-body text-signal underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              {sourceName}
            </a>
          ) : (
            <span className="font-sans text-body text-ink">{sourceName}</span>
          )}
        </>
      ) : null}
    </p>
  );
}
