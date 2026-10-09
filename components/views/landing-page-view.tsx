"use client"

import { LandingNavigation } from "@/components/landing/landing-navigation"
import { LaunchClubs } from "@/components/landing/launch-clubs"
import type { LaunchClub } from "@/lib/launch-clubs"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
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
import "./landing.css"

interface LandingPageViewProps {
  onNavigateToApp: (role?: "student" | "leader") => void
  launchClubs?: LaunchClub[]
  campusName?: string
}

export function LandingPageView({
  onNavigateToApp,
  launchClubs = [],
  campusName = "University of Virginia",
}: LandingPageViewProps) {
  const [info, setInfo] = useState<string | null>(null)
  const { perspective, switchPerspective } = useLandingPerspective()
  const createProfile = () => { window.location.href = "/signup" }
  const enterLeader = () => { window.location.href = "/signup?intent=leader" }
  const start = () => perspective === "student" ? createProfile() : enterLeader()
  return (
    <ScrollMotion className="oc-landing" id="top">
      <LandingNavigation />
      <a className="oc-skip-link" href="#about">Skip to product overview</a>
      <PublicNavigation hero />
      <main>
        <LandingIntro>
          <LandingHero perspective={perspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} />
        </LandingIntro>
        <LaunchClubs clubs={launchClubs} />
        <ProductJourney perspective={perspective} onPerspectiveChange={switchPerspective} onCreateProfile={createProfile} onLeaderEnter={enterLeader} />
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
      <PublicFooter homeHref="#top" overviewHref="#about">
        {["Contact", "Privacy", "Terms"].map((label) => (
          <button type="button" key={label} onClick={() => setInfo(label)}>
            {label}
          </button>
        ))}
      </PublicFooter>
      <p className="oc-photo-credit">
        OutClass is an independent platform.
      </p>
      <Dialog
        open={!!info}
        onOpenChange={(open) => {
          if (!open) setInfo(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{info}</DialogTitle>
            <DialogDescription>
              {info === "Contact"
                ? "Interested in bringing OutClass to your club? Explore the club workspace to learn about the campus pilot."
                : `${info ?? "Service"} information will be published before launch. The product examples on this page use illustrative data.`}
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
