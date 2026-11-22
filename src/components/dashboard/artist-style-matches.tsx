import { LoadError } from "./load-error";
import { LoadingRows } from "./loading-rows";
import { SourceTrustLine } from "./source-trust-line";
import type { ArtistDirectoryState } from "./types";

export function ArtistStyleMatches({
  directory,
  activeStyle,
  excludeArtistId,
  onRetry,
}: {
  directory: ArtistDirectoryState;
  activeStyle: string;
  excludeArtistId?: string;
  onRetry(): void;
}) {
  if (directory.status === "loading") {
    return (
      <LoadingRows label="Loading artist style matches" variant="artist" />
    );
  }

  if (directory.status === "error") {
    return (
      <LoadError
        message="Artist style matches are unavailable."
        onRetry={onRetry}
      />
    );
  }

  const artists = directory.artists.filter(
    (artist) =>
      artist.id !== excludeArtistId &&
      (activeStyle === "all" || artist.styles.includes(activeStyle)),
  );

  return (
    <div className="border-b border-rule py-5">
      <h4 className="font-mono text-label uppercase tracking-[0.18em] text-ink-faint">
        {activeStyle === "all" ? "Artist directory" : `Artists tagged ${activeStyle}`}
      </h4>
      {artists.length === 0 ? (
        <p className="mt-3 text-body text-ink-dim">
          No verified artists match that style.
        </p>
      ) : (
        <ol className="mt-2">
          {artists.map((artist) => (
            <li key={artist.id} className="border-t border-rule py-3">
              <h5 className="font-display text-xl uppercase leading-none text-ink">
                {artist.name}
              </h5>
              <p className="mt-2 font-mono text-meta uppercase tracking-[0.13em] text-ink-faint">
                {artist.styles.join(" / ")}
              </p>
              {artist.links.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {artist.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-rule px-3 py-2 font-mono text-label uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
              <SourceTrustLine source={artist.source} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
