"use client"

import type { LandingPerspective } from "./journey-content"
import { JourneyTabs } from "./journey-tabs"
import { WatchVideoButton } from "./promo-video"
import "./journey.css"
import "./journey-tabs.css"
import "./journey-atmosphere.css"
import "./public-foundations.css"
import type { useJourneyNavigation } from "@/hooks/use-journey-navigation"

/** "How OutClass works" (docs/public-site/redesign/Main.mockup.html): a heading and one tabbed walkthrough. */
export function ProductJourney({ perspective, navigation }: {
  perspective: LandingPerspective
  navigation: ReturnType<typeof useJourneyNavigation>
}) {
  return (
    <section ref={navigation.showcaseRef} id="about" className="oc-product-stories" aria-labelledby="how-title">
      <span id="students" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Student product overview" />
      <span id="club-leaders" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <span id="clubs" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <div className="oc-how-introduction">
        <p className="oc-journey-kicker">How OutClass works</p>
        <h2 id="how-title">{perspective === "student" ? "From discovering a club to joining it." : "From first applicant to your next class."}</h2>
        {/* Students get their video in the hero; leaders also get the long one here, beside the steps it follows. */}
        {perspective === "leader" && <WatchVideoButton video="club-walkthrough" label="Watch the full walkthrough" className="oc-how-watch" />}
      </div>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <JourneyTabs perspective={perspective} />
    </section>
  )
}
