export function MatchMeter({ score }: { score: number }) {
  const filled = Math.round(score * 10);
  const pct = Math.round(score * 100);
  return (
    <span className="inline-flex shrink-0 items-center gap-2 font-mono text-sm">
      <span aria-hidden className="tracking-[0.05em]">
        <span className="text-signal">{"█".repeat(filled)}</span>
        <span className="text-rule-strong">{"░".repeat(10 - filled)}</span>
      </span>
      <span className="font-semibold text-signal tabular-nums">
        {score.toFixed(2)}
      </span>
      <span className="sr-only">Match {pct} percent</span>
    </span>
  );
}
