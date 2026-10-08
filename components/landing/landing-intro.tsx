import type { ReactNode } from "react"
import { ArrowDown } from "lucide-react"
import { CampusBackdrop } from "./campus-backdrop"
import "./intro.css"

/** The original split photographs open behind one immediately readable hero. */
export function LandingIntro({ children }: { children: ReactNode }) {
  return (
    <div className="oc-landing-intro">
      <div className="oc-intro-visual">
        <div className="oc-opening-underlay" aria-hidden="true">
          <CampusBackdrop view="sunset-rotunda" priority="auto" />
        </div>
        {children}
        <div className="oc-opening-panels" aria-hidden="true">
          <div className="oc-opening-panel oc-opening-left">
            <CampusBackdrop view="football" />
          </div>
          <div className="oc-opening-panel oc-opening-right">
            <CampusBackdrop view="trees" />
          </div>
        </div>
        <a className="oc-intro-scroll" href="#about">
          See how it works <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
