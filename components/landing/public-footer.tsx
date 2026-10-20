import type { ReactNode } from "react"
import { OutClassLogo } from "@/components/outclass-logo"
import { FooterAudienceLinks, FooterBackToTop } from "@/components/landing/footer-controls"
import { InteractiveFooterWordmark } from "@/components/landing/interactive-footer-wordmark"
import type { LandingPerspective } from "./journey-content"

/** One shared public footer; account workspaces retain their own layouts. */
export function PublicFooter({ homeHref = "/", overviewHref = "/#about", onPerspectiveChange, contact, children, legalNote = "OutClass is operated by OutClassPlatforms LLC and is independent from universities." }: {
  homeHref?: string
  overviewHref?: string
  onPerspectiveChange?: (perspective: LandingPerspective) => void
  contact?: ReactNode
  children?: ReactNode
  legalNote?: string
}) {
  return (
    <footer className="oc-public-footer" aria-label="OutClass footer">
      <div className="oc-footer-inner">
        <div className="oc-footer-masthead">
          <a href={homeHref} aria-label="OutClass home"><OutClassLogo variant="dark" /></a>
          <p>Find your people. Make your mark.</p>
        </div>
        <nav className="oc-footer-navigation" aria-label="Footer navigation">
          <div className="oc-footer-group">
            <h3>Platform</h3>
            <FooterAudienceLinks onPerspectiveChange={onPerspectiveChange} />
            <a href={overviewHref}>How It Works</a>
          </div>
          <div className="oc-footer-group">
            <h3>OutClass</h3>
            <a href="/about">About OutClass</a>
            <a href="/uva">OutClass at UVA</a>
            <a href="/request-school">Request Your School</a>
            <a href="/uva#faq">FAQ</a>
            {contact}
          </div>
          <div className="oc-footer-group">
            <h3>Account</h3>
            <a href="/signup">Get Started</a>
            <a href="/login">Log In</a>
          </div>
          {children && <div className="oc-footer-group"><h3>Legal</h3>{children}</div>}
        </nav>
        <InteractiveFooterWordmark />
        <div className="oc-footer-bottom">
          <small>© {new Date().getFullYear()} OutClassPlatforms LLC · OutClass</small>
          <p>{legalNote}</p>
          <FooterBackToTop />
        </div>
      </div>
    </footer>
  )
}
