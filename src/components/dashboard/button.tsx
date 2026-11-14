import type { ButtonHTMLAttributes } from "react";

const variantClass = {
  quiet:
    "shrink-0 border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal",
  // Active panel treatment. Current action buttons stay on quiet and
  // report the pressed state with aria-pressed.
  pressed:
    "shrink-0 border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] bg-panel text-signal transition-colors duration-150 hover:bg-panel hover:text-signal",
} as const;

export function Button({
  variant = "quiet",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClass;
}) {
  return (
    <button {...props} type={type} className={variantClass[variant]} />
  );
}
