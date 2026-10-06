import { campusIllustrations, type CampusIllustrationOptions } from "@/lib/campus-illustrations"

/** External SVG groups inherit the existing UI colors; artwork carries no content or focus. */
export function CampusIllustration({ variant, treatment = "standard", accent = true, motion = "none" }: CampusIllustrationOptions) {
  const art = campusIllustrations[variant]
  const source = `/images/campus/illustrations/${art.asset}.svg`
  return <span className="oc-campus-illustration" data-variant={variant} data-scale={art.scale} data-treatment={treatment} data-motion={motion} aria-hidden="true">
    <svg viewBox={art.viewBox} fill="none" focusable="false" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <use href={`${source}#linework`} />
      {accent && <use className="oc-campus-illustration-accent" href={`${source}#accent`} />}
    </svg>
  </span>
}
