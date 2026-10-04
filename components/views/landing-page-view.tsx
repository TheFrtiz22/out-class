"use client"

import { LandingNavigation } from "@/components/landing/landing-navigation"
import { LaunchClubs } from "@/components/landing/launch-clubs"
import type { LaunchClub } from "@/lib/launch-clubs"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
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
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { ProductJourney } from "@/components/landing/product-stories"
import { useLandingPerspective } from "@/hooks/use-landing-perspective"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"
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
  const [signup, setSignup] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const { perspective, switchPerspective } = useLandingPerspective()
  const enterLeader = () => onNavigateToApp("leader")
  const start = () => perspective === "student" ? setSignup(true) : enterLeader()
  return (
    <ScrollMotion className="oc-landing" id="top">
      <LandingNavigation />
      <a className="oc-skip-link" href="#about">Skip to product overview</a>
      <LandingNavbar
        onSignIn={() => onNavigateToApp(perspective)}
        onGetStarted={start}
      />
      <main>
        <LandingIntro>
          <LandingHero perspective={perspective} onCreateProfile={() => setSignup(true)} onLeaderEnter={enterLeader} />
        </LandingIntro>
        <LaunchClubs clubs={launchClubs} />
        <ProductJourney perspective={perspective} onPerspectiveChange={switchPerspective} onCreateProfile={() => setSignup(true)} onLeaderEnter={enterLeader} />
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
      <footer className="oc-public-footer">
        <div>
          <a href="#top" aria-label="OutClass home">
            <OutClassLogo className="h-8 w-auto" />
          </a>
          <p>Find your people. Make your mark.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#about">How it works</a>
          {["Contact", "Privacy", "Terms"].map((label) => (
            <button type="button" key={label} onClick={() => setInfo(label)}>
              {label}
            </button>
          ))}
        </nav>
        <small>© {new Date().getFullYear()} OutClass</small>
      </footer>
      <p className="oc-photo-credit">
        OutClass is an independent platform.
      </p>
      <Dialog open={signup} onOpenChange={setSignup}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create your student profile</DialogTitle>
            <DialogDescription>Begin with your UVA account.</DialogDescription>
          </DialogHeader>
          <StudentOnboardingWizard
            embedded
            onComplete={() => {
              window.location.href = "/"
            }}
            onSignIn={() => {
              setSignup(false)
              onNavigateToApp("student")
            }}
          />
        </DialogContent>
      </Dialog>
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
