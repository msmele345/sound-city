import Link from "next/link";

export function NothingTonight({
  dayKey,
  label,
}: {
  dayKey: string;
  label: string;
}) {
  return (
    <p className="border-b border-rule py-5 text-body text-ink">
      Nothing on tonight.{" "}
      <Link
        href={`/events#day-${dayKey}`}
        className="inline-flex min-h-9 items-center text-signal underline decoration-rule-strong underline-offset-4 pointer-coarse:min-h-11"
      >
        Next is {label}
      </Link>
    </p>
  );
}
