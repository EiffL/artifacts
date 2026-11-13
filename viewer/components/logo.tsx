import { cn } from "@/lib/utils"

/**
 * The brand mark in its compact drawing: one open stroke that draws a page and a G, ending at
 * a point. The geometry is brand/logo/gist-artifacts-compact.svg, and brand/tools/check_assets.py
 * fails when the two differ.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
    >
      <path
        d="M26 12L18 4H10A4 4 0 0 0 6 8V24A4 4 0 0 0 10 28H22A4 4 0 0 0 26 24V18H16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="18" r="4" fill="var(--brand-marker)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>Gist Artifacts</span>
    </span>
  )
}
