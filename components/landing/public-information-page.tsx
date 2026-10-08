import type { ReactNode } from "react"
import { PublicNavigation } from "./public-navigation"
import { PublicFooter } from "./public-footer"
import { LandingNavigation } from "./landing-navigation"
import { ScrollMotion } from "@/components/motion/scroll-motion"
import "@/components/views/landing.css"
import "./public-foundations.css"
import "./public-information.css"

/** Public information stays server-rendered, using the landing page's brand and controls. */
export function PublicInformationPage({ eyebrow, title, introduction, children, heroAside, heroActions, className = "" }: {
  eyebrow: string
  title: string
  introduction: string
  children: ReactNode
  heroAside?: ReactNode
  heroActions?: ReactNode
  className?: string
}) {
  return (
    <ScrollMotion className={`oc-landing oc-information ${className}`}>
      <LandingNavigation />
      <a className="oc-skip-link" href="#main-content">Skip to content</a>
      <PublicNavigation />
      <main id="main-content">
        <section className="oc-information-hero" aria-labelledby="information-title" data-split={!!heroAside}>
          <div className="oc-information-hero-copy">
            <p className="oc-public-kicker">{eyebrow}</p>
            <h1 id="information-title">{title}</h1>
            <p className="oc-information-introduction">{introduction}</p>
            {heroActions}
          </div>
          {heroAside && <div className="oc-information-hero-aside">{heroAside}</div>}
        </section>
        <div className="oc-information-content">{children}</div>
      </main>
      <PublicFooter />
      <p className="oc-photo-credit">OutClass is an independent platform, not an official University of Virginia service.</p>
    </ScrollMotion>
  )
}
