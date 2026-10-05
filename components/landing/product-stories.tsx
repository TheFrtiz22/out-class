"use client"

import { ArrowUpRight } from "lucide-react"
import { StickyStory } from "@/components/motion/scroll-motion"
import { ProductMotion, ProductMotionControl } from "./product-motion"
import { PerspectiveSwitcher } from "./perspective-switcher"
import { JourneyScenePreview } from "./journey-scenes"
import { journeyChapters, journeySceneDurations, type LandingPerspective } from "./journey-content"
import "./journey.css"
import "./journey-atmosphere.css"

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
      <div className="oc-journey-controls">
        <h2 id="perspective-title">One experience. Two perspectives.</h2>
        <PerspectiveSwitcher perspective={perspective} onChange={onPerspectiveChange} />
      </div>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <div id="product-journey" data-perspective={perspective}>
        {chapters.map((chapter, index) => (
          <StickyStory key={index} id={`journey-${index + 1}`} className="oc-product-story" aria-labelledby={`journey-${index + 1}-title`}>
            <div className="oc-story-copy">
              <div key={perspective} className="oc-perspective-copy">
                <p className="oc-story-eyebrow"><span>{String(index + 1).padStart(2, "0")}</span>{chapter.label.toUpperCase()}</p>
                <h2 id={`journey-${index + 1}-title`}>{chapter.title}</h2>
                <p>{chapter.description}</p>
              </div>
              {index === chapters.length - 1 && <button type="button" className="oc-story-link" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {perspective === "student" ? "Create your profile" : "Explore club workspace"}<ArrowUpRight size={16} aria-hidden="true" />
              </button>}
            </div>
            <div className="oc-story-visual">
              <ProductMotion duration={journeySceneDurations[chapter.scene]} resetKey={`${perspective}-${chapter.scene}`}>
                <figure className="oc-story-frame">
                  <div className="oc-story-toolbar"><span>OutClass</span><strong>{perspective === "student" ? "Student workspace" : "Club workspace"}</strong><span><ProductMotionControl /></span></div>
                  <div className="oc-story-interface"><div key={perspective} className="oc-perspective-scene" data-scene={chapter.scene}><JourneyScenePreview scene={chapter.scene} /></div></div>
                  <figcaption>Illustrative interface · sample information</figcaption>
                </figure>
              </ProductMotion>
            </div>
          </StickyStory>
        ))}
      </div>
    </section>
  )
}
