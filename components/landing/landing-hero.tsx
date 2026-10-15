import { ArrowRight } from "@/components/icons"
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
      <div className="oc-hero-introduction" data-scroll-indicator-content="">
        <div className="oc-hero-copy">
          <p className="oc-hero-context">Made for University of Virginia</p>
          <h1 id="outclass-hero-title" className="oc-hero-headline">
            {perspective === "student" ? "Find and apply to participating UVA clubs with one profile." : "Build your next class. Bring your club together."}
          </h1>
          <p className="oc-hero-tagline">{perspective === "student" ? "One profile. Every opportunity." : "Your people. A clearer process."}</p>
          <div className="oc-hero-support">
            <p>{perspective === "student" ? "Stay on top of applications, interviews, and decisions, all in one place." : "Applications, interview panels, decisions, and member life. One workspace for the team behind it all."}</p>
            <div className="oc-hero-ctas">
              <Button size="lg" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {perspective === "student" ? "Create your profile" : "Explore club workspace"}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <p className="oc-hero-audience">For UVA students and the clubs they’ll call home.</p>
          </div>
        </div>
        <HeroFeatureStack key={perspective} perspective={perspective} />
      </div>
    </section>
  )
}
