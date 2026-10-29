import { Skeleton } from "@/components/ui/skeleton"
import { GlowingLoadingPill } from "@/components/ui/glowing-loading-pill"
import "./operational-dashboard.css"

/** Uses the same locale as memberDate; the full timestamp remains next to this visual date. */
export function DashboardDate({ value }: { value: Date | string }) {
  const date = new Date(value)
  return <span className="oc-calendar-date" aria-hidden="true"><span>{date.toLocaleDateString([], { month: "short" })}</span><strong>{date.getDate()}</strong></span>
}

export function DashboardLoading({ mode, label = "Loading club activity…" }: { mode: "recruiting" | "club"; label?: string }) {
  return <div className={`oc-command-center oc-command-${mode} oc-dashboard-loading`} role="status" aria-busy="true">
    <GlowingLoadingPill label={label} />
    <div aria-hidden="true"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-7 w-64 max-w-full" />
      {mode === "recruiting" && <div className="oc-loading-pipeline">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>}
      <div className="oc-command-columns"><div className="oc-loading-records">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14" />)}</div><div className="oc-loading-records">{[0, 1].map(i => <Skeleton key={i} className={mode === "club" ? "h-28" : "h-20"} />)}</div></div>
    </div>
  </div>
}
