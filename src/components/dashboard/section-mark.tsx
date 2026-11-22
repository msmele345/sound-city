// Spec-sheet section marker: heading + a mono index tag sharing one strong rule.
// The tag is metadata (queue / index), not a restatement of the heading.
export function SectionMark({
  id,
  title,
  index,
}: {
  id: string;
  title: string;
  index: string;
}) {
  return (
    <div className="flex w-full min-w-0 scroll-mt-24 flex-col items-start gap-2 border-b-2 border-rule-strong pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <h2
        id={id}
        tabIndex={-1}
        className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal sm:text-3xl"
      >
        {title}
      </h2>
      <span className="max-w-full shrink-0 font-mono text-label uppercase tracking-[0.18em] text-ink-faint">
        {index}
      </span>
    </div>
  );
}
