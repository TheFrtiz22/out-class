"use client"

import { useState } from "react"
import { ArrowRight, Menu, X } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollMotion, SectionReveal, TextReveal } from "@/components/motion/scroll-motion"
import { LandingHero } from "@/components/landing/landing-hero"
import { ProductStories } from "@/components/landing/product-stories"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"
import "./landing.css"

interface LandingPageViewProps {
  onNavigateToApp: (role?: "student" | "leader") => void
  campusName?: string
}

export function LandingPageView({ onNavigateToApp, campusName = "University of Virginia" }: LandingPageViewProps) {
  const [menu, setMenu] = useState(false)
  const [signup, setSignup] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  return <ScrollMotion className="oc-landing" id="top">
    <header className="oc-header oc-hero-header">
      <a href="#top" aria-label="OutClass home"><OutClassLogo className="h-10 w-auto" /></a>
      <nav id="public-navigation" aria-label="Public navigation" className={menu ? "open" : ""}>
        <a href="#students" onClick={() => setMenu(false)}>For students</a>
        <a href="#clubs" onClick={() => setMenu(false)}>For clubs</a>
        <a href="#create-account" onClick={() => setMenu(false)}>Get started</a>
      </nav>
      <div className="nav-actions"><button type="button" className="nav-cta" onClick={() => onNavigateToApp("student")}>Sign in</button><button type="button" className="mobile-menu" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} aria-controls="public-navigation" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>
    </header>
    <main>
      <LandingHero campusName={campusName} />
      <ProductStories onLeaderEnter={() => onNavigateToApp("leader")} />
      <SectionReveal id="create-account" className="oc-final-invitation" aria-labelledby="invitation-title">
        <p data-motion="context" className="oc-story-eyebrow">Beginning at {campusName}</p>
        <TextReveal asChild><h2 id="invitation-title">Your next chapter starts here.</h2></TextReveal>
        <p data-motion="body">One profile. A little more possibility.</p>
        <Button size="lg" onClick={() => setSignup(true)}>Create your profile<ArrowRight aria-hidden="true" size={16} /></Button>
        <p id="pricing" className="oc-invitation-note">Free for students. Clubs join the campus pilot individually.</p>
      </SectionReveal>
    </main>
    <footer className="oc-public-footer"><div><a href="#top" aria-label="OutClass home"><OutClassLogo className="h-8 w-auto" /></a><p>Find your people. Make your mark.</p></div><nav aria-label="Footer navigation"><a href="#about">How it works</a>{["Contact", "Privacy", "Terms"].map(label => <button type="button" key={label} onClick={() => setInfo(label)}>{label}</button>)}</nav><small>© {new Date().getFullYear()} OutClass</small></footer>
    <Dialog open={signup} onOpenChange={setSignup}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Create your student profile</DialogTitle><DialogDescription>Begin with your UVA account.</DialogDescription></DialogHeader><StudentOnboardingWizard embedded onComplete={() => { window.location.href = "/" }} onSignIn={() => { setSignup(false); onNavigateToApp("student") }} /></DialogContent></Dialog>
    <Dialog open={!!info} onOpenChange={open => { if (!open) setInfo(null) }}><DialogContent><DialogHeader><DialogTitle>{info}</DialogTitle><DialogDescription>{info === "Contact" ? "Interested in bringing OutClass to your club? Explore the club workspace to learn about the campus pilot." : `${info ?? "Service"} information will be published before launch. The product examples on this page use illustrative data.`}</DialogDescription></DialogHeader><Button onClick={() => { if (info === "Contact") onNavigateToApp("leader"); setInfo(null) }}>{info === "Contact" ? "Explore club workspace" : "Close"}</Button></DialogContent></Dialog>
  </ScrollMotion>
}
