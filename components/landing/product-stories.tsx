"use client"

import { ArrowUpRight } from "lucide-react"
import { StickyStory } from "@/components/motion/scroll-motion"
import { ProductMotion, ProductMotionControl } from "./product-motion"
import { PerspectiveSwitcher } from "./perspective-switcher"
import { JourneyScenePreview } from "./journey-scenes"
import { journeyChapters, journeySceneDurations, type LandingPerspective } from "./journey-content"
import "./journey.css"
import "./journey-atmosphere.css"
import "./public-foundations.css"
import "./product-story-editorial.css"

export function ProductJourney({ perspective, onPerspectiveChange, onCreateProfile, onLeaderEnter }: {
  perspective: LandingPerspective
  onPerspectiveChange: (perspective: LandingPerspective) => void
  onCreateProfile: () => void
  onLeaderEnter: () => void
}) {
  const chapters = journeyChapters[perspective]
  return (
    <section id="about" className="oc-product-stories" aria-label="How OutClass works">
      <span id="students" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Student product overview" />
      <span id="club-leaders" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <span id="clubs" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <div className="oc-how-introduction oc-public-section">
        <p className="oc-public-kicker">How OutClass works</p>
        <h2>From curious<br />to connected.</h2>
        <p>College club recruitment, brought together. Discover organizations, apply through one profile, and keep your next steps in view.</p>
        <span className="oc-public-note">Beginning with participating clubs at the University of Virginia.</span>
      </div>
      <div className="oc-journey-controls">
        <h2 id="perspective-title">Two sides of the same opportunity.</h2>
        <PerspectiveSwitcher perspective={perspective} onChange={onPerspectiveChange} />
      </div>
      <nav className="oc-journey-index" aria-label={`${perspective === "student" ? "Student" : "Club leader"} walkthrough chapters`}>
        {chapters.map((chapter, index) => <a key={chapter.stage} href={`#journey-${index + 1}`}><span aria-hidden="true">0{index + 1}</span>{chapter.label}</a>)}
      </nav>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <div id="product-journey" data-perspective={perspective}>
        {chapters.map((chapter, index) => (
          <StickyStory key={chapter.stage} id={`journey-${index + 1}`} data-stage={chapter.stage} className="oc-product-story" aria-labelledby={`journey-${index + 1}-title`}>
            <div className="oc-story-copy">
              <div key={perspective} className="oc-perspective-copy">
                <p className="oc-stage-marker"><span>{String(index + 1).padStart(2, "0")}</span>{chapter.label}</p>
                <h2 id={`journey-${index + 1}-title`}>{chapter.title}</h2>
                <p>{chapter.description}</p>
              </div>
              <p className="oc-stage-detail">{chapter.detail}</p>
              {index === chapters.length - 1 && <button type="button" className="oc-story-link" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {perspective === "student" ? "Create your profile" : "Explore club workspace"}<ArrowUpRight size={16} aria-hidden="true" />
              </button>}
            </div>
            <div className="oc-story-visual">
              <ProductMotion duration={journeySceneDurations[chapter.scene]} resetKey={`${perspective}-${chapter.scene}`}>
                <figure className="oc-story-frame">
                  <div className="oc-story-toolbar"><span>OutClass</span><strong>{perspective === "student" ? "Student workspace" : "Club workspace"}</strong><span><ProductMotionControl /></span></div>
                  <div className="oc-story-interface"><div key={perspective} className="oc-perspective-scene" data-scene={chapter.scene}><JourneyScenePreview scene={chapter.scene} /></div></div>
                  <figcaption><span>{chapter.label} with OutClass</span><span>Illustrative interface · sample information</span></figcaption>
                </figure>
              </ProductMotion>
            </div>
          </StickyStory>
        ))}
      </div>
    </section>
  )
}
