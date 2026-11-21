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
    <div className="flex w-full min-w-0 flex-col items-start gap-2 border-b-2 border-rule-strong pb-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <h2
        id={id}
        className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl"
      >
        {title}
      </h2>
      <span className="max-w-full shrink-0 font-mono text-label uppercase tracking-[0.18em] text-ink-faint">
        {index}
      </span>
    </div>
  );
}
