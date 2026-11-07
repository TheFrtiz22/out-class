import { ArrowRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { HeroFeatureStack } from "./hero-feature-stack"
import type { LandingPerspective } from "./journey-content"
import "./hero.css"

const copy = {
  student: {
    headline: "Find and apply to UVA clubs with one profile.",
    tagline: "Discover clubs. Apply with confidence.",
    support: "Track applications, interviews and decisions in one place.",
    cta: "Create your profile",
  },
  leader: {
    headline: "Build your next class. Bring your club together.",
    tagline: "Your people. A clearer process.",
    support: "Applications, interview panels, decisions and member life, in one workspace for your team.",
    cta: "Set up your club",
  },
} as const

export function LandingHero({ perspective, onPerspectiveChange, onCreateProfile, onLeaderEnter }: {
  perspective: LandingPerspective
  onPerspectiveChange: (perspective: LandingPerspective) => void
  onCreateProfile: () => void
  onLeaderEnter: () => void
}) {
  const text = copy[perspective]
  return (
    <section id="landing-content" tabIndex={-1} className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
      <div className="oc-hero-introduction" data-scroll-indicator-content="">
        <div className="oc-hero-copy">
          <p className="oc-hero-context">Made for University of Virginia</p>
          <SegmentedControl className="oc-hero-audience-toggle" label="Show OutClass for" value={perspective} onChange={onPerspectiveChange}
            options={[{ value: "student", label: "Students" }, { value: "leader", label: "Club Leaders" }]} />
          <h1 id="outclass-hero-title" className="oc-hero-headline">{text.headline}</h1>
          <p className="oc-hero-tagline">{text.tagline}</p>
          <div className="oc-hero-support">
            <p>{text.support}</p>
            <div className="oc-hero-ctas">
              <Button size="lg" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {text.cta}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
        <HeroFeatureStack key={perspective} perspective={perspective} />
      </div>
    </section>
  )
}
