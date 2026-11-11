"use client"
import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { useDemoMode } from "@/contexts/demo-context"
import { SelectedClubWorkspace } from "@/components/selected-club-workspace"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { TERMS } from "@/lib/copy/terms"
const ClubAnnouncements = dynamic(() => import("@/components/club-announcements").then(m => m.ClubAnnouncements), { loading: () => <WorkspaceLoading label="Loading announcements…" layout="feed" rows={3} /> })

/**
 * The full announcements feed on Home (it used to be its own page): publish, schedule, audiences and history.
 * Old `section=announcements` links land here with `focus=announcements`, which scrolls to and focuses this section;
 * `compose=1` (Home's "New announcement") opens the composer. Rendered only for members who can post.
 */
export function HomeAnnouncements({ clubId, privacyScope }: { clubId: string; privacyScope: string }) {
  const params = useSearchParams(), demo = useDemoMode()
  const heading = useRef<HTMLHeadingElement>(null)
  const focus = params.get("focus") === "announcements" && params.get("compose") !== "1"
  useEffect(() => {
    if (!focus) return
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    heading.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    heading.current?.focus({ preventScroll: true })
  }, [focus])
  return <section id="announcements" aria-labelledby="home-announcements-heading" className="oc-home-announcements oc-workspace-stack mt-10 scroll-mt-24">
    <h2 id="home-announcements-heading" ref={heading} tabIndex={-1} className="oc-section-heading outline-none">{TERMS.announcements}</h2>
    {demo.isDemoEnabled ? <ClubAnnouncements key={clubId} clubId={clubId} /> : <SelectedClubWorkspace kind="announcements" clubId={clubId} privacyScope={privacyScope} />}
  </section>
}
