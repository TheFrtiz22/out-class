import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
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
      <header className="oc-header">
        <Link href="/" prefetch={false} aria-label="OutClass home"><OutClassLogo className="h-10 w-auto" /></Link>
        <nav className="nav-actions" aria-label="Main navigation">
          <Button variant="outline" className="nav-cta" asChild><a href="/login">Sign in</a></Button>
          <Button asChild><Link href="/#about" prefetch={false}>Explore OutClass <ArrowRight size={16} aria-hidden="true" /></Link></Button>
        </nav>
      </header>
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
