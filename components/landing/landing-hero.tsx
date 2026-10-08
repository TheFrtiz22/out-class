import { ArrowRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroFeatureStack } from "./hero-feature-stack"
import type { LandingPerspective } from "./journey-content"
import "./hero.css"

export function LandingHero({ perspective, onCreateProfile, onLeaderEnter }: {
  perspective: LandingPerspective
  onCreateProfile: () => void
  onLeaderEnter: () => void
}) {
  return (
    <section id="landing-content" tabIndex={-1} className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
      <div className="oc-hero-introduction">
        <div className="oc-hero-copy">
          <p className="oc-hero-context">Made for University of Virginia</p>
          <h1 id="outclass-hero-title" className="oc-hero-headline">
            <span>One profile.</span>
            <span>Every opportunity.</span>
          </h1>
          <div className="oc-hero-support">
            <p>Discover student organizations, apply with one profile, and keep every interview and next step together.</p>
            <div className="oc-hero-ctas">
              <Button size="lg" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {perspective === "student" ? "Create your profile" : "Explore club workspace"}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <a className="oc-hero-demo-link" href="/preview?view=student-dashboard">
                Explore the demo <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="oc-hero-audience">For UVA students and the clubs they’ll call home.</p>
          </div>
        </div>
        <HeroFeatureStack />
      </div>
    </section>
  )
}
