"use client"

import type { LandingPerspective } from "./journey-content"

export function PerspectiveSwitcher({ perspective, onChange, compact = false }: {
  perspective: LandingPerspective
  onChange: (perspective: LandingPerspective) => void
  compact?: boolean
}) {
  return (
    <div className="oc-perspective-switcher" role="group" aria-labelledby={compact ? undefined : "perspective-title"} aria-label={compact ? "Showcase perspective" : undefined} data-compact={compact} data-perspective={perspective}>
      <span className="oc-perspective-indicator" aria-hidden="true" />
      <button type="button" data-perspective-option="student" aria-pressed={perspective === "student"} aria-controls="product-journey" onClick={() => onChange("student")}>{compact ? "Students" : "For Students"}</button>
      <button type="button" data-perspective-option="leader" aria-pressed={perspective === "leader"} aria-controls="product-journey" onClick={() => onChange("leader")}>{compact ? "Club Leaders" : "For Club Leaders"}</button>
    </div>
  )
}
