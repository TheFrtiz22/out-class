"use client"

import type { LandingPerspective } from "./journey-content"

export function PerspectiveSwitcher({ perspective, onChange }: {
  perspective: LandingPerspective
  onChange: (perspective: LandingPerspective) => void
}) {
  return (
    <div className="oc-perspective-switcher" role="group" aria-label="Product perspective" data-perspective={perspective}>
      <span className="oc-perspective-indicator" aria-hidden="true" />
      <button type="button" aria-pressed={perspective === "student"} aria-controls="product-journey" onClick={() => onChange("student")}>Students</button>
      <button type="button" aria-pressed={perspective === "leader"} aria-controls="product-journey" onClick={() => onChange("leader")}>Club Leaders</button>
    </div>
  )
}
