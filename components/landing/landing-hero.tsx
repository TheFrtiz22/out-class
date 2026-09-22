import { DepthTransition } from "@/components/motion/scroll-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CampusBackdrop } from "./campus-backdrop"
import { RecruitmentDemo } from "./recruitment-demo"
import "./hero.css"

function HeroEditorialDetails({ campusName }: { campusName: string }) {
  return (
    <div className="oc-hero-marginalia" aria-hidden="true">
      <div className="oc-hero-margin-left">
        <i />
        <span>
          Students
          <br />
          Clubs
          <br />
          Community
          <br />
          Opportunity
        </span>
      </div>
      <div className="oc-hero-margin-right">
        <p>
          Great opportunities
          <br />
          start here.
        </p>
        <i />
        <span>{campusName === "University of Virginia" ? "UVA" : campusName}</span>
      </div>
    </div>
  )
}
export function LandingHero({
  campusName = "University of Virginia",
  onCreateProfile,
}: {
  campusName?: string
  onCreateProfile: () => void
}) {
  return (
    <section className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
      <div className="oc-hero-environment">
        <CampusBackdrop />
      </div>
      <HeroEditorialDetails campusName={campusName} />
      <div className="oc-hero-introduction">
        <p className="oc-hero-context">{campusName}</p>
        <h1 id="outclass-hero-title">
          <span>One profile.</span>
          <span>Every opportunity.</span>
        </h1>
        <div className="oc-hero-support">
          <p>
            The recruiting platform for selective student organizations.
            <br className="oc-hero-desktop-break" /> Discover, apply, and get in — all in one place.
          </p>
          <div className="oc-hero-ctas">
            <Button size="lg" onClick={onCreateProfile}>
              Create your profile
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
          <p className="oc-hero-footnote">
            Free for {campusName === "University of Virginia" ? "UVA" : "university"} students
          </p>
        </div>
      </div>
      <div className="oc-hero-preview-entrance">
        <DepthTransition>
          <RecruitmentDemo />
        </DepthTransition>
      </div>
    </section>
  )
}
