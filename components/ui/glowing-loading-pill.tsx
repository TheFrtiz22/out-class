import { cn } from "@/lib/utils"

/**
 * Small indeterminate activity marker, inspired by the understated glowing
 * ring / dark capsule treatment from the Homay Framer marketplace reference.
 *
 * Parent loading regions own role="status" and the accessible label.
 * The ring itself is decorative; this component does not announce progress.
 */
export function GlowingLoadingPill({
  label,
  compact = false,
  className,
}: {
  label: string
  compact?: boolean
  className?: string
}) {
  return (
    <span
      data-slot="glowing-loading-pill"
      data-size={compact ? "compact" : "default"}
      className={cn("oc-glow-loading-pill", className)}
    >
      <span className="oc-glow-loading-ring" aria-hidden="true" />
      <span className="oc-glow-loading-label">{label}</span>
    </span>
  )
}
