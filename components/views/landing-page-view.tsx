"use client"

import { LandingNavigation } from "@/components/landing/landing-navigation"
import { LaunchClubs } from "@/components/landing/launch-clubs"
import type { LaunchClub } from "@/lib/launch-clubs"
import { PublicFooter } from "@/components/landing/public-footer"
import { CampusBand } from "@/components/landing/campus-band"
import { Button } from "@/components/ui/button"
import { ScrollMotion } from "@/components/motion/scroll-motion"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingIntro } from "@/components/landing/landing-intro"
import { PublicNavigation } from "@/components/landing/public-navigation"
import { ProductJourney } from "@/components/landing/product-stories"
import { ScatteredTools } from "@/components/landing/scattered-tools"
import { LandingMoments } from "@/components/landing/landing-moments"
import { useLandingPerspective } from "@/hooks/use-landing-perspective"
import { useJourneyNavigation } from "@/hooks/use-journey-navigation"
import "./landing.css"
import "@/components/landing/public-footer.css"
import type { LandingPerspective } from "@/components/landing/journey-content"
import { DEFAULT_LANDING_AUDIENCE } from "@/lib/landing-audience"

interface LandingPageViewProps {
  onNavigateToApp: (role?: "student" | "leader") => void
  launchClubs?: LaunchClub[]
  initialAudience?: LandingPerspective
}

export function LandingPageView({
  onNavigateToApp: _onNavigateToApp,
  launchClubs = [],
  initialAudience = DEFAULT_LANDING_AUDIENCE,
}: LandingPageViewProps) {
  const { perspective, selected, switchPerspective } = useLandingPerspective(initialAudience)
  const journeyNavigation = useJourneyNavigation()
  // Leaders and students share one signup (there is no separate leader path in the
  // onboarding wizard); leaders then accept their club's invitation or claim its page.
  const createProfile = () => { window.location.href = "/signup" }
  const enterLeader = createProfile
  const start = createProfile
  return (
    <ScrollMotion className="oc-landing" id="top" data-landing-audience={perspective}>
      <LandingNavigation />
      <a className="oc-skip-link" href="#about">Skip to product overview</a>
      <PublicNavigation hero navigationRef={journeyNavigation.headerRef} journey={{ perspective: selected, onChange: switchPerspective, merged: journeyNavigation.merged }} />
      <main>
        <LandingIntro>
          <LandingHero perspective={perspective} selected={selected} onPerspectiveChange={switchPerspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} />
        </LandingIntro>
        {/* The sticky nav carries the audience switch from below the hero until the footer (useJourneyNavigation). */}
        <div className="oc-journey-controls-slot" data-merged={journeyNavigation.merged}>
          <span ref={journeyNavigation.controlsRef} className="oc-journey-handoff-sentinel" aria-hidden="true" />
        </div>
        <LaunchClubs clubs={launchClubs} />
        <ScatteredTools />
        <ProductJourney perspective={perspective} navigation={journeyNavigation} />
        <LandingMoments perspective={perspective} />
        <CampusBand />
        <div className="oc-journey-controls-slot">
          <span ref={journeyNavigation.endRef} className="oc-journey-end-sentinel" aria-hidden="true" />
        </div>
      </main>
      <PublicFooter homeHref="#top" overviewHref="#about" onPerspectiveChange={switchPerspective} invitation={
        <div id="create-account" className="oc-footer-invitation" role="group" aria-labelledby="invitation-title">
          <h2 id="invitation-title">Your next <span className="oc-footer-accent">class</span> starts here.</h2>
          <p>{perspective === "student" ? "Create your profile once and use it for every club you apply to." : "Set up your club’s workspace and run this season’s recruitment in one place."}</p>
          <Button size="lg" className="oc-invitation-cta" onClick={start}>
            {perspective === "student" ? "Create your profile" : "Set up your club"}
          </Button>
        </div>
      } />
    </ScrollMotion>
  )
}
