import type { ButtonHTMLAttributes } from "react";

// Unlayered `font: inherit` on button beats layered utilities, so size and
// family are marked important to keep the 12px mono label.
const variantClass = {
  quiet:
    "min-h-9 min-w-9 shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11 border border-rule px-3 py-2 font-mono! text-label! uppercase tracking-[0.14em] text-ink-dim transition-colors duration-150 hover:bg-panel hover:text-signal",
  // Active panel class string. No caller selects this variant.
  pressed:
    "min-h-9 min-w-9 shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11 border border-rule px-3 py-2 font-mono! text-label! uppercase tracking-[0.14em] bg-panel text-signal transition-colors duration-150 hover:bg-panel hover:text-signal",
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
