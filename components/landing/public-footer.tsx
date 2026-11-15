import type { ReactNode } from "react"
import Image from "next/image"
import { FooterAudienceLinks, FooterBackToTop } from "@/components/landing/footer-controls"
import { InteractiveFooterWordmark } from "@/components/landing/interactive-footer-wordmark"
import type { LandingPerspective } from "./journey-content"
import { CONTACT_HREF, LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"
import { PHOTO_CREDITS } from "@/lib/photo-credits"

/**
 * One shared public footer on every public page (account workspaces keep their own layouts): a navy glass
 * panel over the Rotunda with the tagline, link columns, the full-width wordmark and the legal line. The
 * homepage passes `invitation` so its final call to action opens the same panel
 * (docs/public-site/redesign/Main.mockup.html).
 */
export function PublicFooter({ homeHref = "/", overviewHref = "/#about", onPerspectiveChange, invitation, legalNote = "OutClass is operated by OutClassPlatforms LLC and is not an official University of Virginia service." }: {
  homeHref?: string
  overviewHref?: string
  onPerspectiveChange?: (perspective: LandingPerspective) => void
  invitation?: ReactNode
  legalNote?: string
}) {
  return (
    <footer className="oc-public-footer" aria-label="OutClass footer">
      <div className="oc-footer-frame">
        {/* Below the fold on every page, so the photograph loads lazily and never competes with LCP. */}
        <Image className="oc-footer-photo" src="/images/campus/rotunda-1600.webp" alt="" fill sizes="(max-width: 1720px) 100vw, 1680px" loading="lazy" />
        <div className="oc-footer-panel oc-public-glass-navy">
          {invitation}
          <div className="oc-footer-columns">
            <p className="oc-footer-tagline">Find your people.<br />Make your mark.</p>
            <nav className="oc-footer-navigation" aria-label="Footer navigation">
              <div className="oc-footer-group">
                <h2>Platform</h2>
                <FooterAudienceLinks onPerspectiveChange={onPerspectiveChange} />
                <a href={overviewHref}>How It Works</a>
              </div>
              <div className="oc-footer-group">
                <h2>OutClass</h2>
                <a href="/about">About OutClass</a>
                <a href="/uva">OutClass at UVA</a>
                <a href="/request-school">Request Your School</a>
                <a href="/uva#faq">FAQ</a>
              </div>
              <div className="oc-footer-group">
                <h2>Account</h2>
                <a href="/signup">Get Started</a>
                <a href="/login">Sign in</a>
              </div>
              {LEGAL_PAGES_PUBLIC && <div className="oc-footer-group">
                <h2>Legal</h2>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/cookies">Cookies</a>
                <a href="/legal">Legal</a>
                <a href={CONTACT_HREF}>Contact</a>
              </div>}
            </nav>
          </div>
          <a className="oc-footer-home" href={homeHref} aria-label="OutClass home"><InteractiveFooterWordmark /></a>
          <div className="oc-footer-bottom">
            <small>© 2026 OutClassPlatforms LLC. All rights reserved.</small>
            <p>{legalNote}</p>
            <FooterBackToTop />
            <p className="oc-footer-credits">
              <span>Photo credits:</span>{" "}
              {PHOTO_CREDITS.map((photo, index) => (
                <span key={photo.source}>
                  {index > 0 && "; "}
                  <a href={photo.source} rel="noopener noreferrer">“{photo.title}”</a> by {photo.author},{" "}
                  <a href={photo.licenseUrl} rel="license noopener noreferrer">{photo.license}</a>
                  {photo.note && ` (${photo.note})`}
                </span>
              ))}
              . No endorsement by the photographers is implied.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
