import type { ReactNode } from "react"
import { ArrowDown } from "lucide-react"
import { CampusBackdrop } from "./campus-backdrop"
import "./intro.css"

/** Immediate photography and readable content, with no entrance sequence. */
export function LandingIntro({ children }: { children: ReactNode }) {
  return (
    <div className="oc-landing-intro">
      <div className="oc-intro-visual">
        <div className="oc-intro-backdrop" aria-hidden="true">
          <CampusBackdrop view="sunset-rotunda" />
        </div>
        {children}
        <a className="oc-intro-scroll" href="#about">
          See how it works <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
