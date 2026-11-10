"use client"
import { useEffect, useState } from "react"
import { getRecruitingInsights } from "@/actions/recruiting-insights"
import { calibrationLabel } from "@/lib/recruiting-insights"
import { DashboardCard, DashboardFoot, DashboardQuiet, MetricTiles } from "@/components/product/dashboard/dashboard"
import { useDemoMode } from "@/contexts/demo-context"

type Insights = Awaited<ReturnType<typeof getRecruitingInsights>>

/** Two quiet cards for recruitment leads: how applicants move through the cycle,
 * and whether any reviewer scores consistently higher or lower than their panel. */
export function RecruitingInsightsCards({ clubId, index }: { clubId: string; index: number }) {
  const demo = useDemoMode()
  const [data, setData] = useState<Insights | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (demo.isDemoEnabled) return
    let current = true
    getRecruitingInsights(clubId).then(next => { if (current) setData(next) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [clubId, demo.isDemoEnabled])
  if (demo.isDemoEnabled || failed || !data || !data.funnel.applied) return null
  const f = data.funnel, rate = (n: number) => f.applied ? `${Math.round(n / f.applied * 100)}%` : "—"
  const flagged = data.reviewers.filter(r => r.offset !== null && Math.abs(r.offset) >= 0.5)
  return <>
    <DashboardCard id="dashboard-funnel" title="Conversion" aside={data.cycleName ?? undefined} index={index}>
      <MetricTiles items={[{ label: "Applied", value: f.applied }, { label: `Interviewed · ${rate(f.interviewed)}`, value: f.interviewed }, { label: `Admitted · ${rate(f.admitted)}`, value: f.admitted }, { label: `Joined · ${rate(f.joined)}`, value: f.joined }]} />
    </DashboardCard>
    {data.reviewers.length > 0 && <DashboardCard id="dashboard-calibration" title="Reviewer calibration" index={index + 1}>
      {flagged.length ? <ul className="space-y-2 text-sm">{flagged.slice(0, 5).map(r => <li key={r.memberId}><strong className="font-medium">{r.name}</strong><span className="block text-muted-foreground">{calibrationLabel(r.offset)} · {r.compared} shared</span></li>)}</ul>
        : <DashboardQuiet>Reviewers are scoring in line with each other.</DashboardQuiet>}
      <DashboardFoot>Compared only with other panelists on the same applicant and round. Raw scores are unchanged.</DashboardFoot>
    </DashboardCard>}
  </>
}
