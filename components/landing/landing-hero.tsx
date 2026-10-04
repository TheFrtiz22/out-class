import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
        <h1 id="outclass-hero-title"><span>One profile.</span><span>Every opportunity.</span></h1>
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
