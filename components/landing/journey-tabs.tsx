"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { equivalentJourneyStage, journeyChapterHref, journeyChapters, journeySample, type JourneyStage, type LandingPerspective } from "./journey-content"
import { audienceFromPreference, audienceFromQuery, LANDING_AUDIENCE_PREFERENCE } from "@/lib/landing-audience"
import { StatusMark } from "@/components/ui/status-pill"

type Selection = { perspective: LandingPerspective; index: number }

/** `#journey-N` (built by journeyChapterHref) names a step of the `?audience=` story. A bare hash resolves the
 *  audience as useLandingPerspective does (query, stored preference, then the current audience), because on
 *  first load this runs before the hook's choice has committed. */
function selectionFromLocation(fallback: LandingPerspective): Selection | null {
  const match = /^#journey-(\d+)$/.exec(window.location.hash)
  if (!match) return null
  let saved: LandingPerspective | null = null
  try { saved = audienceFromPreference(window.localStorage.getItem(LANDING_AUDIENCE_PREFERENCE)) } catch { /* Storage may be blocked. */ }
  const perspective = audienceFromQuery(new URLSearchParams(window.location.search).get("audience")) ?? saved ?? fallback
  const last = journeyChapters[perspective].length - 1
  return { perspective, index: Math.min(Math.max(Number(match[1]) - 1, 0), last) }
}

/** "How OutClass works": one tab per step, one tabpanel. Arrow keys, Home and End move between tabs (Radix). */
export function JourneyTabs({ perspective }: { perspective: LandingPerspective }) {
  const chapters = journeyChapters[perspective]
  const [selection, setSelection] = useState<Selection>({ perspective, index: 0 })
  // When the audience changes, keep the task being read (Interview stays Interview; Track becomes Decide).
  const stage: JourneyStage = selection.perspective === perspective
    ? chapters[selection.index].stage
    : equivalentJourneyStage(journeyChapters[selection.perspective][selection.index].stage, perspective)
  const index = Math.max(0, chapters.findIndex(chapter => chapter.stage === stage))
  const chapter = chapters[index]
  const sample = journeySample(perspective, chapter.stage)

  // The audience the page has settled on (the hook resolves hash, query and stored preference after SSR).
  const current = useRef(perspective)
  useLayoutEffect(() => { current.current = perspective }, [perspective])

  useEffect(() => {
    const sync = () => {
      const next = selectionFromLocation(current.current)
      if (!next) return
      setSelection(next)
      // An out-of-range step (#journey-9) has no anchor for the browser to scroll to; bring the section into view.
      if (!document.getElementById(window.location.hash.slice(1))) document.getElementById("product-journey")?.scrollIntoView({ block: "start" })
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const choose = (value: string) => {
    const next = chapters.findIndex(item => item.stage === value)
    if (next < 0) return
    setSelection({ perspective, index: next })
    // Keep the address shareable without a navigation or a hash scroll.
    window.history.replaceState(window.history.state, "", journeyChapterHref(perspective, next, window.location.search))
  }

  return (
    <div id="product-journey" className="oc-journey-tabs" data-perspective={perspective}>
      {/* Old deep links (#journey-1 …) still land on this section; the effect above selects their tab. */}
      {chapters.map((item, i) => <span key={item.stage} id={`journey-${i + 1}`} className="oc-journey-anchor" />)}
      <Tabs value={chapter.stage} onValueChange={choose}>
        <TabsList className="oc-journey-tablist" aria-label={perspective === "student" ? "Steps for students" : "Steps for club leaders"}>
          {chapters.map(item => <TabsTrigger key={item.stage} value={item.stage}>{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={chapter.stage} className="oc-journey-panel" data-stage={chapter.stage}>
          <div className="oc-journey-copy">
            <p className="oc-journey-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</p>
            <h3>{chapter.title}</h3>
            <p className="oc-journey-description">{chapter.description}</p>
            <p className="oc-journey-detail">{chapter.detail}</p>
          </div>
          {sample && <figure className="oc-journey-card oc-public-glass" aria-label={`Sample data: ${sample.card}`}>
            <div className="oc-journey-screen">
              <div className="oc-journey-screen-header">
                <div><p>{sample.card}</p><p>{sample.sub}</p></div>
                <span className="oc-journey-sample">Sample data</span>
              </div>
              <ul>
                {sample.rows.map(row => (
                  <li key={row.name}>
                    <div><p className="oc-journey-row-name">{row.name}</p><p className="oc-journey-row-meta">{row.meta}</p></div>
                    <StatusMark className="oc-journey-chip" label={row.chip} tone={row.tone === "navy" ? "strong" : row.tone} />
                  </li>
                ))}
              </ul>
            </div>
          </figure>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
