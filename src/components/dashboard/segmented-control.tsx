export function SegmentedControl<Value extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange(value: Value): void;
}) {
  const labelId = `${name}-label`;

  return (
    <div className="min-w-0">
      <div
        id={labelId}
        className="font-mono text-label uppercase tracking-[0.18em] text-ink-faint"
      >
        {label}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-2 flex min-w-0 flex-col border border-rule sm:flex-row"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`pressable relative min-h-9 min-w-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11 flex min-w-0 flex-1 cursor-pointer items-center border-rule px-3 py-2 font-mono text-label uppercase tracking-[0.14em] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal ${
                index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""
              } ${selected ? "bg-panel text-signal" : "text-ink-dim hover:bg-panel"}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="absolute inset-0 cursor-pointer opacity-0 focus-visible:outline-none"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
