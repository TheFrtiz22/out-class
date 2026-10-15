"use client"

import { PerspectiveSwitcher } from "./perspective-switcher"
import type { LandingPerspective } from "./journey-content"
import { FeatureOrbit } from "./feature-orbit"
import "./journey.css"
import "./journey-atmosphere.css"
import "./public-foundations.css"
import "./product-story-editorial.css"
import "./demo-playback.css"
import type { useJourneyNavigation } from "@/hooks/use-journey-navigation"

export function ProductJourney({ perspective, onPerspectiveChange, onCreateProfile, onLeaderEnter, navigation }: {
  perspective: LandingPerspective
  onPerspectiveChange: (perspective: LandingPerspective) => void
  onCreateProfile: () => void
  onLeaderEnter: () => void
  navigation: ReturnType<typeof useJourneyNavigation>
}) {
  return (
    <section ref={navigation.showcaseRef} id="about" className="oc-product-stories" aria-label="How OutClass works">
      <span id="students" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Student product overview" />
      <span id="club-leaders" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <span id="clubs" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <div className="oc-how-introduction oc-public-section">
        <p className="oc-public-kicker">How OutClass works</p>
        <h2>{perspective === "student" ? <>From curious<br />to connected.</> : <>From first applicant<br />to your next class.</>}</h2>
        <p>{perspective === "student" ? "College club recruitment, brought together. Discover organizations, apply through one profile, and keep your next steps in view." : "One workspace for the people building campus communities. Shape your recruitment, coordinate your team, and welcome the members who come next."}</p>
        <span className="oc-public-note">Beginning with participating clubs at the University of Virginia.</span>
      </div>
      <div className="oc-journey-controls-slot" data-merged={navigation.merged}>
        <span ref={navigation.controlsRef} className="oc-journey-handoff-sentinel" aria-hidden="true" />
        <div className="oc-journey-controls" inert={navigation.merged} aria-hidden={navigation.merged}>
          <h2 id="perspective-title">Two sides of the same opportunity.</h2>
          <PerspectiveSwitcher perspective={perspective} onChange={onPerspectiveChange} />
        </div>
      </div>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <FeatureOrbit key={perspective} perspective={perspective} onComplete={perspective === "student" ? onCreateProfile : onLeaderEnter} />
      <span ref={navigation.endRef} className="oc-journey-end-sentinel" aria-hidden="true" />
    </section>
  )
}
