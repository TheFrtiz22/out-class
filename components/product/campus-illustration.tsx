import type { CSSProperties } from "react"
import { campusIllustrations, type CampusIllustrationOptions } from "@/lib/campus-illustrations"

/** Exact approved vectors; host colors match the supplied standalone defaults. Decorative only. */
export function CampusIllustration({ variant, treatment = "standard", accent = true, presentation = "standard", motion = "none" }: CampusIllustrationOptions) {
  const art = campusIllustrations[variant]
  const source = `/images/campus/illustrations/${art.asset}.svg`
  return <span className="oc-campus-illustration" data-variant={variant} data-scale={art.scale} data-treatment={treatment} data-motion={motion} data-presentation={presentation} style={{ "--oc-campus-aspect-ratio": art.aspectRatio } as CSSProperties} aria-hidden="true">
    <svg viewBox={art.viewBox} fill="none" focusable="false" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <use href={`${source}#linework`} />
      {accent && <use className="oc-campus-illustration-accent" href={`${source}#accent`} />}
    </svg>
  </span>
}
