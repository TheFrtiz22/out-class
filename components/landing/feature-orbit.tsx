"use client"

import { useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUpRight } from "@/components/icons"
import { OutClassLogo } from "@/components/outclass-logo"
import { useFeatureOrbit } from "@/hooks/use-feature-orbit"
import { DemoCursor, DemoPlaybackProvider, ProductMotion, ProductMotionControl, ProductDemoProgress } from "./product-motion"
import { JourneyScenePreview } from "./journey-scenes"
import { journeyChapters, journeyChapterHref, type LandingPerspective } from "./journey-content"
import "./feature-orbit.css"

export function FeatureOrbit({ perspective, onComplete }: { perspective: LandingPerspective; onComplete: () => void }) {
  const chapters = journeyChapters[perspective]
  const search = useSearchParams().toString()
  const { rootRef, active, settled, enhanced } = useFeatureOrbit(chapters.length)
  return <div ref={rootRef} id="product-journey" className="oc-feature-orbit" role="group" data-perspective={perspective} aria-label={`${perspective === "student" ? "Student" : "Club leader"} feature showcase`}>
    <div className="oc-orbit-waypoints">
      {chapters.map((chapter, index) => <div key={chapter.stage} id={`journey-${index + 1}`} tabIndex={-1} role="group" aria-label={`${chapter.label} feature`} data-orbit-anchor="" data-stage={chapter.stage} style={{ top: `calc(var(--oc-orbit-step, 80svh) * ${index})` }} />)}
    </div>
    <div className="oc-orbit-stage">
      <div className="oc-orbit-heading"><span>{perspective === "student" ? "Your next chapter" : "Your next class"}</span><span>One connected journey <ArrowUpRight size={16} className="inline-block rotate-90 align-text-bottom" /></span></div>
      <DemoPlaybackProvider activeScene={enhanced ? settled === null ? null : chapters[settled].scene : undefined}>
        <div className="oc-orbit-scenes">
          {chapters.map((chapter, index) => <article key={chapter.stage} data-orbit-card="" className="oc-orbit-card" aria-labelledby={`orbit-${chapter.stage}-title`}>
            <div className="oc-orbit-copy">
              <div className="oc-orbit-title"><p className="oc-orbit-marker"><span>{String(index + 1).padStart(2, "0")}</span>{chapter.label}</p><h2 id={`orbit-${chapter.stage}-title`}>{chapter.title}</h2></div>
              <div className="oc-orbit-description"><p>{chapter.description}</p></div>
            </div>
            <ProductMotion scene={chapter.scene} resetKey={`${perspective}-${chapter.scene}`}>
              <figure className="oc-story-frame">
                <div className="oc-story-toolbar"><OutClassLogo className="oc-demo-wordmark" /><strong>{perspective === "student" ? "Student workspace" : "Club workspace"}</strong><span><ProductMotionControl /></span></div>
                <div className="oc-story-interface"><div className="oc-demo-observation" inert aria-hidden="true"><div className="oc-perspective-scene" data-scene={chapter.scene}><JourneyScenePreview scene={chapter.scene} /></div></div><DemoCursor /></div>
                <figcaption><span>{chapter.label} with OutClass</span><ProductDemoProgress /></figcaption>
              </figure>
            </ProductMotion>
            <div className="oc-orbit-footnote"><p>{chapter.detail}</p>{index === chapters.length - 1 && <button type="button" onClick={onComplete}>{perspective === "student" ? "Create your profile" : "Explore club workspace"}<ArrowUpRight size={14} aria-hidden="true" /></button>}</div>
          </article>)}
        </div>
      </DemoPlaybackProvider>
      <nav className="oc-orbit-index" aria-label="Feature navigation">
        {chapters.map((chapter, index) => <a key={chapter.stage} href={journeyChapterHref(perspective, index, search)} aria-current={active === index ? "step" : undefined}><span className="oc-orbit-index-number">{String(index + 1).padStart(2, "0")}</span><span>{chapter.label}</span><span className="oc-orbit-index-track" aria-hidden="true" /></a>)}
      </nav>
      <a className="oc-orbit-exit" href="#create-account">{active === chapters.length - 1 ? "Your next chapter starts here" : "Scroll to explore"}<ArrowDown size={12} aria-hidden="true" /><span>Skip to get started</span></a>
    </div>
  </div>
}
