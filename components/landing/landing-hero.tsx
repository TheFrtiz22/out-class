import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OutClassLogo } from "@/components/outclass-logo"
import type { LandingPerspective } from "./journey-content"
import "./hero.css"

export function LandingHero({ perspective, onCreateProfile, onLeaderEnter }: {
  perspective: LandingPerspective
  onCreateProfile: () => void
  onLeaderEnter: () => void
}) {
  return (
    <section className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
      <div className="oc-hero-introduction">
        <p className="oc-hero-context">The recruiting platform for selective student organizations</p>
        <h2 id="outclass-hero-title" className="oc-hero-brand">
          <OutClassLogo variant="dark" className="oc-hero-wordmark" />
        </h2>
        <div className="oc-hero-support">
          <p>Discover, apply, interview, and keep every next step in one place.</p>
          <div className="oc-hero-ctas">
            <Button size="lg" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
              {perspective === "student" ? "Create your profile" : "Explore club workspace"}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
