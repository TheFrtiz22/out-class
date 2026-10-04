import type { ReactNode } from "react"
import { ArrowDown } from "lucide-react"
import { CampusBackdrop } from "./campus-backdrop"
import "./intro.css"

/** One hero, already beneath the photographs; the document drives the reveal. */
export function LandingIntro({ children }: { children: ReactNode }) {
  return (
    <div className="oc-landing-intro">
      <div id="landing-content" className="oc-opening-destination" tabIndex={-1}>
        <span className="sr-only">OutClass overview</span>
      </div>
      <div className="oc-intro-visual">
        <div className="oc-opening-underlay" aria-hidden="true">
          <CampusBackdrop view="sunset-rotunda" priority="auto" />
        </div>
        <h1 id="outclass-intro-title" className="oc-intro-headline">
          <span>One profile.</span>
          <span>Every opportunity.</span>
        </h1>
        {children}
        <div className="oc-opening-panels" aria-hidden="true">
          <div className="oc-opening-panel oc-opening-left">
            <CampusBackdrop view="football" />
          </div>
          <div className="oc-opening-panel oc-opening-right">
            <CampusBackdrop view="trees" />
          </div>
        </div>
        <a className="oc-intro-scroll" href="#landing-content">
          Discover OutClass <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}
