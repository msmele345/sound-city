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
      className={`relative inline-flex max-w-full shrink-0 cursor-pointer items-center border px-3 py-2 text-left font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal ${
        pressed
          ? "border-signal bg-panel text-signal"
          : "border-rule text-ink-dim hover:bg-panel"
      }`}
    >
      <input
        {...props}
        type="checkbox"
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {children}
    </label>
  );
}
