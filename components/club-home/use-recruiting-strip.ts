"use client"
import { useEffect, useState } from "react"
import { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { recruitingStrip, type RailHrefs, type RecruitingStrip } from "@/components/club-home/club-home-model"

/**
 * Club home loads club data only; the recruiting strip reads its small summary (intake, cycles, round
 * counts, votes) after the page has painted, and only for members with a recruiting tool. A failed read
 * hides the strip: it is a link, never the only way to reach recruiting.
 */
export function useRecruitingStrip(clubId: string, hrefs: RailHrefs) {
  const [strip, setStrip] = useState<{ clubId: string; value: RecruitingStrip | null } | null>(null)
  const enabled = !!hrefs.recruiting
  useEffect(() => {
    if (!enabled) return
    let current = true
    getClubWorkspaceOverview(clubId, "strip")
      .then(data => { if (current) setStrip({ clubId, value: recruitingStrip(data, hrefs) }) })
      .catch(() => { if (current) setStrip({ clubId, value: null }) })
    return () => { current = false }
    // hrefs derive from the membership; the recruiting href is the only part this read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, enabled, hrefs.recruiting])
  return enabled && strip?.clubId === clubId ? strip.value : null
}
