import type { InputHTMLAttributes, ReactNode } from "react";

export function Chip({
  pressed,
  children,
  ...props
}: {
  pressed: boolean;
  children: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label
      className={`inline-flex max-w-full shrink-0 cursor-pointer items-center gap-2 border border-rule px-3 py-2 text-left font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors duration-150 ${
        pressed ? "bg-panel text-signal" : "text-ink-dim hover:bg-panel"
      }`}
    >
      <input {...props} type="checkbox" className="size-3 accent-signal" />
      {children}
    </label>
  );
}
