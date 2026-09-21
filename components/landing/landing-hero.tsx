import { DepthTransition } from "@/components/motion/scroll-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CampusBackdrop } from "@/components/landing/campus-backdrop"
import { StudentWorkspacePreview } from "@/components/landing/student-workspace-preview"
import "./hero.css"

export function LandingHero({ campusName = "University of Virginia" }: { campusName?: string }) {
  return <section className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
    <div className="oc-hero-environment"><CampusBackdrop /></div>
    <div className="oc-hero-introduction">
      <p className="oc-hero-context"><span aria-hidden="true" />Beginning at the {campusName}</p>
      <h1 id="outclass-hero-title"><span>One profile.</span><span>Every opportunity.</span></h1>
      <div className="oc-hero-support">
        <p>Your home for selective college club recruitment.<br className="oc-hero-desktop-break" /> Discover your people. Apply with confidence.</p>
        <div className="oc-hero-ctas"><Button asChild size="lg"><a href="#create-account">Create your profile<ArrowRight size={16} aria-hidden="true" /></a></Button><a className="oc-hero-secondary" href="#clubs">For club leaders<ArrowUpRight size={15} aria-hidden="true" /></a></div>
        <p className="oc-hero-footnote">Free for students. Built for your next chapter.</p>
      </div>
    </div>
    <div className="oc-hero-preview-entrance"><p className="oc-campus-caption">Campus study · illustration placeholder</p><DepthTransition><StudentWorkspacePreview /></DepthTransition></div>
    <div className="oc-hero-bridge" aria-hidden="true"><span />A thoughtful start to what comes next<span /></div>
  </section>
}
