import type { ReactNode } from "react"
import { PublicNavigation } from "./public-navigation"
import { PublicFooter } from "./public-footer"
import { LandingNavigation } from "./landing-navigation"
import "@/components/views/landing.css"
import "./public-foundations.css"
import "./public-information.css"
import "./public-footer.css"

/**
 * Public chrome for pages that are not editorial information pages (signed-out Corkboard, club
 * profiles, sign-in cards, legal pages): the shared public header, normal page margins and the
 * shared footer. Server-rendered; the page's own content supplies the h1.
 */
export function PublicPageFrame({ children, className = "", width = "content" }: { children: ReactNode; className?: string; width?: "content" | "reading" | "narrow" }) {
  return <div id="top" className={`oc-landing oc-information oc-public-frame ${className}`}>
    <LandingNavigation />
    <a className="oc-skip-link" href="#main-content">Skip to content</a>
    <PublicNavigation />
    <main id="main-content" className="oc-public-frame-main" data-width={width}>{children}</main>
    <PublicFooter />
  </div>
}
