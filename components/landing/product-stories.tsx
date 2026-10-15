"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUpRight } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { StickyStory } from "@/components/motion/scroll-motion"
import { DemoCursor, DemoPlaybackProvider, ProductMotion, ProductMotionControl, ProductDemoProgress } from "./product-motion"
import { PerspectiveSwitcher } from "./perspective-switcher"
import { JourneyScenePreview } from "./journey-scenes"
import { journeyChapters, journeyChapterHref, journeyExample, type LandingPerspective } from "./journey-content"
import "./journey.css"
import "./journey-atmosphere.css"
import "./public-foundations.css"
import "./product-story-editorial.css"
import "./demo-playback.css"
import type { useJourneyNavigation } from "@/hooks/use-journey-navigation"

export function ProductJourney({ perspective, onPerspectiveChange, onCreateProfile, onLeaderEnter, navigation }: {
  perspective: LandingPerspective
  onPerspectiveChange: (perspective: LandingPerspective) => void
  onCreateProfile: () => void
  onLeaderEnter: () => void
  navigation: ReturnType<typeof useJourneyNavigation>
}) {
  const chapters = journeyChapters[perspective]
  const search = useSearchParams().toString()
  const [active, setActive] = useState(0)
  useEffect(() => {
    setActive(0)
    if (!window.IntersectionObserver) return
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
      if (visible.length) setActive(Number((visible[0].target as HTMLElement).dataset.chapter))
    }, { rootMargin: "-20% 0px -55% 0px", threshold: 0 })
    document.querySelectorAll("#product-journey [data-chapter]").forEach(chapter => observer.observe(chapter))
    return () => observer.disconnect()
  }, [perspective])
  return (
    <section ref={navigation.showcaseRef} id="about" className="oc-product-stories" aria-label="How OutClass works">
      <span id="students" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Student product overview" />
      <span id="club-leaders" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <span id="clubs" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <div className="oc-how-introduction oc-public-section">
        <p className="oc-public-kicker">How OutClass works</p>
        <h2>{perspective === "student" ? <>From curious<br />to connected.</> : <>From first applicant<br />to your next class.</>}</h2>
        <p>{perspective === "student" ? "College club recruitment, brought together. Discover organizations, apply through one profile, and keep your next steps in view." : "One workspace for the people building campus communities. Shape your recruitment, coordinate your team, and welcome the members who come next."}</p>
        <span className="oc-public-note">Beginning with participating clubs at the University of Virginia.</span>
      </div>
      <div className="oc-journey-controls-slot" data-merged={navigation.merged}>
        <span ref={navigation.controlsRef} className="oc-journey-handoff-sentinel" aria-hidden="true" />
        <div className="oc-journey-controls" inert={navigation.merged} aria-hidden={navigation.merged}>
          <h2 id="perspective-title">Two sides of the same opportunity.</h2>
          <PerspectiveSwitcher perspective={perspective} onChange={onPerspectiveChange} />
        </div>
      </div>
      <nav className="oc-journey-index" style={{ "--oc-chapter-count": chapters.length } as CSSProperties} aria-label={`${perspective === "student" ? "Student" : "Club leader"} walkthrough chapters`}>
        {chapters.map((chapter, index) => <a key={chapter.stage} href={journeyChapterHref(perspective, index, search)} aria-current={active === index ? "step" : undefined}><span aria-hidden="true">0{index + 1}</span>{chapter.label}</a>)}
      </nav>
      <p className="oc-journey-thread"><span aria-hidden="true" />One club. One connected journey.<span>Follow {perspective === "student" ? "Jordan’s next chapter" : "Jordan through your recruitment"} below.</span></p>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <DemoPlaybackProvider key={perspective}><div id="product-journey" data-perspective={perspective}>
        {chapters.map((chapter, index) => (
          <StickyStory key={chapter.stage} id={`journey-${index + 1}`} data-stage={chapter.stage} data-chapter={index} className="oc-product-story" aria-labelledby={`journey-${index + 1}-title`}>
            <div className="oc-story-copy">
              <div key={perspective} className="oc-perspective-copy">
                <p className="oc-stage-marker"><span>{String(index + 1).padStart(2, "0")}</span>{chapter.label}</p>
                <h2 id={`journey-${index + 1}-title`}>{chapter.title}</h2>
                <p>{chapter.description}</p>
              </div>
              <p className="oc-stage-detail">{chapter.detail}</p>
              {index < chapters.length - 1 && <a className="oc-story-continuation" href={journeyChapterHref(perspective, index + 1, search)}><ArrowDown size={14} aria-hidden="true" />Up next: {chapters[index + 1].label}</a>}
              {index === chapters.length - 1 && <button type="button" className="oc-story-link" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
                {perspective === "student" ? "Create your profile" : "Explore club workspace"}<ArrowUpRight size={16} aria-hidden="true" />
              </button>}
            </div>
            <div className="oc-story-visual">
              <ProductMotion scene={chapter.scene} resetKey={`${perspective}-${chapter.scene}`}>
                <figure className="oc-story-frame">
                  <div className="oc-story-toolbar"><OutClassLogo className="oc-demo-wordmark" /><strong>{perspective === "student" ? "Student workspace" : "Club workspace"}</strong><span><ProductMotionControl /></span></div>
                  <div className="oc-demo-workspace-context"><span>{journeyExample.clubMark} <span aria-hidden="true">/</span> {chapter.label}</span><span>{perspective === "student" ? journeyExample.initials : "AJ"}</span></div>
                  <div className="oc-story-interface"><div className="oc-demo-observation" inert aria-hidden="true"><div key={perspective} className="oc-perspective-scene" data-scene={chapter.scene}><JourneyScenePreview scene={chapter.scene} /></div></div><DemoCursor /></div>
                  <figcaption><span>{chapter.label} with OutClass</span><ProductDemoProgress /></figcaption>
                </figure>
              </ProductMotion>
            </div>
          </StickyStory>
        ))}
      </div></DemoPlaybackProvider>
      <span ref={navigation.endRef} className="oc-journey-end-sentinel" aria-hidden="true" />
    </section>
  )
}
