import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder in the dashboard layout: a Needs you row, then the card grid, all glass. */
export function DashboardLoading({ mode, label = "Loading club activity…" }: { mode: "recruiting" | "club"; label?: string }) {
  return <div className={`oc-dashboard oc-command-center oc-command-${mode} oc-dashboard-loading`} role="status" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="oc-dashboard-loading-needs" aria-hidden="true">{[0, 1, 2].map(i => <Skeleton key={i} className="h-36" />)}</div>
    <div className="oc-dashboard-grid" aria-hidden="true">
      <div className="oc-dashboard-main">{[0, 1].map(i => <Skeleton key={i} className={i ? "h-48" : "h-40"} />)}</div>
      <div className="oc-dashboard-side">{[0, 1].map(i => <Skeleton key={i} className={mode === "club" ? "h-56" : "h-40"} />)}</div>
    </div>
  </div>
}
