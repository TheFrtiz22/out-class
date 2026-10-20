"use client"

import { LandingNavigation } from "@/components/landing/landing-navigation"
import { LaunchClubs } from "@/components/landing/launch-clubs"
import type { LaunchClub } from "@/lib/launch-clubs"
import { useRef, useState, type MouseEvent } from "react"
import { ArrowRight } from "@/components/icons"
import { PublicFooter } from "@/components/landing/public-footer"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollMotion, SectionReveal, TextReveal } from "@/components/motion/scroll-motion"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingIntro } from "@/components/landing/landing-intro"
import { PublicNavigation } from "@/components/landing/public-navigation"
import { ProductJourney } from "@/components/landing/product-stories"
import { useLandingPerspective } from "@/hooks/use-landing-perspective"
import { useJourneyNavigation } from "@/hooks/use-journey-navigation"
import "./landing.css"
import "@/components/landing/public-footer.css"
import type { LandingPerspective } from "@/components/landing/journey-content"

interface LandingPageViewProps {
  onNavigateToApp: (role?: "student" | "leader") => void
  launchClubs?: LaunchClub[]
  campusName?: string
  initialAudience?: LandingPerspective
}

export function LandingPageView({
  onNavigateToApp,
  launchClubs = [],
  campusName = "University of Virginia",
  initialAudience = "leader",
}: LandingPageViewProps) {
  const [info, setInfo] = useState<string | null>(null)
  const infoTrigger = useRef<HTMLButtonElement | null>(null)
  const openInfo = (event: MouseEvent<HTMLButtonElement>, label: string) => {
    infoTrigger.current = event.currentTarget
    setInfo(label)
  }
  const { perspective, switchPerspective } = useLandingPerspective(initialAudience)
  const journeyNavigation = useJourneyNavigation()
  const createProfile = () => { window.location.href = "/signup" }
  const enterLeader = () => { window.location.href = "/signup?intent=leader" }
  const start = () => perspective === "student" ? createProfile() : enterLeader()
  return (
    <ScrollMotion className="oc-landing" id="top" data-landing-audience={perspective}>
      <LandingNavigation />
      <a className="oc-skip-link" href="#about">Skip to product overview</a>
      <PublicNavigation hero navigationRef={journeyNavigation.headerRef} journey={{ perspective, onChange: switchPerspective, merged: journeyNavigation.merged }} />
      <main>
        <LandingIntro>
          <LandingHero perspective={perspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} />
        </LandingIntro>
        <LaunchClubs clubs={launchClubs} />
        <ProductJourney perspective={perspective} onPerspectiveChange={switchPerspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} navigation={journeyNavigation} />
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
            {perspective === "student" ? "Create your profile" : "Explore club workspace"}
            <ArrowRight aria-hidden="true" size={16} />
          </Button>
          <p id="pricing" className="oc-invitation-note">
            Free for students. Clubs join the campus pilot individually.
          </p>
        </SectionReveal>
      </main>
      <PublicFooter homeHref="#top" overviewHref="#about" onPerspectiveChange={switchPerspective} contact={<button type="button" onClick={event => openInfo(event, "Contact")}>Contact</button>}>
        {["Privacy", "Terms"].map((label) => (
          <button type="button" key={label} onClick={event => openInfo(event, label)}>
            {label}
          </button>
        ))}
      </PublicFooter>
      <Dialog
        open={!!info}
        onOpenChange={(open) => {
          if (!open) setInfo(null)
        }}
      >
        <DialogContent onCloseAutoFocus={event => {
          event.preventDefault()
          infoTrigger.current?.focus({ preventScroll: true })
        }}>
          <DialogHeader>
            <DialogTitle>{info}</DialogTitle>
            <DialogDescription>
              {info === "Contact"
                ? "OutClass is operated by OutClassPlatforms LLC, a Virginia limited liability company. Interested in bringing OutClass to your club? Explore the club workspace to learn about the campus pilot."
                : `OutClass is operated by OutClassPlatforms LLC, a Virginia limited liability company. The ${info === "Privacy" ? "Privacy Policy" : "Terms of Service"} has not yet been published. The product examples on this page use illustrative data.`}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              if (info === "Contact") onNavigateToApp("leader")
              setInfo(null)
            }}
          >
            {info === "Contact" ? "Explore club workspace" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </ScrollMotion>
  )
}
