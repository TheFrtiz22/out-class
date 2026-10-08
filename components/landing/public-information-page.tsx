import type { ReactNode } from "react"
import { PublicNavigation } from "./public-navigation"
import { PublicFooter } from "./public-footer"
import "@/components/views/landing.css"
import "./public-information.css"

/** Public information stays server-rendered, using the landing page's brand and controls. */
export function PublicInformationPage({ eyebrow, title, introduction, children }: {
  eyebrow: string
  title: string
  introduction: string
  children: ReactNode
}) {
  return (
    <div className="oc-landing oc-information">
      <a className="oc-skip-link" href="#main-content">Skip to content</a>
      <PublicNavigation />
      <main id="main-content">
        <section className="oc-information-hero" aria-labelledby="information-title">
          <p className="oc-story-eyebrow">{eyebrow}</p>
          <h1 id="information-title">{title}</h1>
          <p className="oc-information-introduction">{introduction}</p>
        </section>
        <div className="oc-information-content">{children}</div>
      </main>
      <PublicFooter />
      <p className="oc-photo-credit">OutClass is an independent platform, not an official University of Virginia service.</p>
    </div>
  )
}
