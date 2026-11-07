import Link from "next/link"
import { ArrowRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { PublicPageFrame } from "@/components/landing/public-page-frame"
import "@/components/landing/sign-in-card.css"

export const metadata = { title: "Page not found" }

export default function NotFound() {
  return <PublicPageFrame width="narrow">
    <section className="oc-sign-in-card" aria-labelledby="not-found-title">
      <p className="oc-sign-in-card-eyebrow">Page not found</p>
      <h1 id="not-found-title">We couldn’t find that page</h1>
      <div className="oc-sign-in-card-body"><p>The link may have changed, or the page is no longer available.</p></div>
      <div className="oc-sign-in-card-actions">
        <Button asChild><Link prefetch={false} href="/">Go to OutClass home<ArrowRight size={16} aria-hidden="true" /></Link></Button>
        <Button asChild variant="outline"><Link prefetch={false} href="/explore">Explore clubs</Link></Button>
      </div>
    </section>
  </PublicPageFrame>
}
