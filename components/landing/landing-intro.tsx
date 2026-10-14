import type { ReactNode } from "react"
import { CampusBackdrop } from "./campus-backdrop"
import { ScrollIndicator } from "./scroll-indicator"
import "./intro.css"

/** Immediate photography and readable content, with no entrance sequence. */
export function LandingIntro({ children }: { children: ReactNode }) {
  return (
    <div className="oc-landing-intro">
      <div className="oc-intro-visual" data-scroll-indicator-region="">
        <div className="oc-intro-backdrop" aria-hidden="true">
          <CampusBackdrop view="sunset-rotunda" />
        </div>
        {children}
        <ScrollIndicator className="oc-intro-scroll" targetId="about" />
      </div>
    </div>
  )
}
