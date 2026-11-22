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
        className="text-signal underline decoration-rule-strong underline-offset-4"
      >
        Next is {label}
      </Link>
    </p>
  );
}
