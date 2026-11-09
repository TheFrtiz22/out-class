"use client"

import { LandingNavigation } from "@/components/landing/landing-navigation"
import { LaunchClubs } from "@/components/landing/launch-clubs"
import type { LaunchClub } from "@/lib/launch-clubs"
import { ArrowRight } from "@/components/icons"
import { PublicFooter } from "@/components/landing/public-footer"
import { Button } from "@/components/ui/button"
import { ScrollMotion, SectionReveal, TextReveal } from "@/components/motion/scroll-motion"
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
  campusName?: string
  initialAudience?: LandingPerspective
}

export function LandingPageView({
  onNavigateToApp: _onNavigateToApp,
  launchClubs = [],
  campusName = "University of Virginia",
  initialAudience = DEFAULT_LANDING_AUDIENCE,
}: LandingPageViewProps) {
  const { perspective, selected, switchPerspective } = useLandingPerspective(initialAudience)
  const journeyNavigation = useJourneyNavigation()
  const createProfile = () => { window.location.href = "/signup" }
  const enterLeader = () => { window.location.href = "/signup?intent=leader" }
  const start = () => perspective === "student" ? createProfile() : enterLeader()
  return (
    <ScrollMotion className="oc-landing" id="top" data-landing-audience={perspective}>
      <LandingNavigation />
      <a className="oc-skip-link" href="#about">Skip to product overview</a>
      <PublicNavigation hero navigationRef={journeyNavigation.headerRef} journey={{ perspective: selected, onChange: switchPerspective, merged: journeyNavigation.merged }} />
      <main>
        <LandingIntro>
          <LandingHero perspective={perspective} selected={selected} onPerspectiveChange={switchPerspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} />
        </LandingIntro>
        <LaunchClubs clubs={launchClubs} />
        <ScatteredTools />
        <ProductJourney perspective={perspective} navigation={journeyNavigation} />
        <LandingMoments perspective={perspective} />
        <SectionReveal
          id="create-account"
          className="oc-final-invitation"
          aria-labelledby="invitation-title"
        >
          <p data-motion="context" className="oc-story-eyebrow oc-invitation-campus">
            Beginning at {campusName}
          </p>
          <TextReveal asChild>
            <h2 id="invitation-title">{perspective === "student" ? "Your next chapter starts here." : "Your next class starts here."}</h2>
          </TextReveal>
          <p data-motion="body">{perspective === "student" ? "A little more possibility." : "Good people. A clearer process."}</p>
          <Button size="lg" className="oc-invitation-cta" aria-describedby="pricing" onClick={start}>
            {perspective === "student" ? "Create your profile" : "Set up your club"}
            <ArrowRight aria-hidden="true" size={16} />
          </Button>
          <p id="pricing" className="oc-invitation-note">
            Free for students. Clubs join the campus pilot individually.
          </p>
        </SectionReveal>
      </main>
      <PublicFooter homeHref="#top" overviewHref="#about" onPerspectiveChange={switchPerspective} />
    </ScrollMotion>
  )
}
