import { LoaderCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export type LoadingLayout = "inline" | "rows" | "cards" | "applications" | "applicants" | "workspace"

/**
 * Placeholders follow the shape of the content being fetched, not a generic full-screen
 * spinner. The label is the only announced content; all visual scaffolding is decorative.
 * These are indeterminate loaders: never imply a percent complete or delay real content.
 */
export function LoadingState({
  label = "Loading…",
  layout = "rows",
  rows = 4,
  className,
}: {
  label?: string
  layout?: LoadingLayout
  rows?: number
  className?: string
}) {
  const count = Math.max(1, Math.min(12, Math.floor(rows) || 4))
  if (layout === "inline") {
    return <div data-slot="loading-state" data-layout="inline" role="status" aria-busy="true" className={cn("oc-loading-state", className)}>
      <LoaderCircle size={16} aria-hidden="true" className="oc-loading-inline-spinner animate-spin" />
      <span>{label}</span>
    </div>
  }

  return <div data-slot="loading-state" data-layout={layout} role="status" aria-busy="true" className={cn("oc-loading-state", className)}>
    <p className="oc-loading-status"><span className="oc-loading-indicator" aria-hidden="true" />{label}</p>
    <div className="oc-loading-preview" aria-hidden="true">
      {layout === "rows" && <div className="oc-loading-list">
        <div className="oc-loading-preview-heading"><Skeleton className="h-6 w-40 max-w-full" /><Skeleton className="h-4 w-24" /></div>
        {Array.from({ length: count }, (_, index) => <LoadingRow key={index} index={index} />)}
      </div>}
      {layout === "cards" && <div className="oc-loading-cards">
        {Array.from({ length: count }, (_, index) => <div key={index} className="oc-loading-card">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="mt-5 h-5 w-3/5" />
          <Skeleton className="mt-3 h-3 w-4/5" />
          <Skeleton className="mt-6 h-3 w-2/5" />
        </div>)}
      </div>}
      {layout === "applications" && <div className="oc-loading-applications">
        <div className="oc-loading-preview-heading"><Skeleton className="h-9 w-48 max-w-full" /><Skeleton className="h-4 w-28" /></div>
        <div className="oc-loading-kpis"><Skeleton className="h-12 w-24" /><Skeleton className="h-12 w-24" /></div>
        <div className="oc-loading-filters"><Skeleton className="h-9 w-20 rounded-full" /><Skeleton className="h-9 w-20 rounded-full" /><Skeleton className="h-9 w-24 rounded-full" /></div>
        {Array.from({ length: Math.min(count, 5) }, (_, index) => <div className="oc-loading-application" key={index}>
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="oc-loading-application-copy"><Skeleton className="h-5 w-3/5" /><Skeleton className="mt-3 h-3 w-4/5" /><Skeleton className="mt-4 h-2 w-2/3" /></div>
          <Skeleton className="oc-loading-application-action h-9 w-28 rounded-lg" />
        </div>)}
      </div>}
      {layout === "applicants" && <div className="oc-loading-applicants">
        <div className="oc-loading-preview-heading"><Skeleton className="h-9 w-56 max-w-full" /><Skeleton className="h-9 w-28 rounded-lg" /></div>
        <div className="oc-loading-kpis oc-loading-pipeline">
          {[0, 1, 2].map(index => <div key={index} className="oc-loading-pipeline-step">
            <Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-8 w-10" /><Skeleton className="mt-3 h-3 w-28 max-w-full" />
          </div>)}
        </div>
        <div className="oc-loading-filters"><Skeleton className="h-9 w-44 rounded-lg" /><Skeleton className="h-9 w-24 rounded-full" /><Skeleton className="h-9 w-24 rounded-full" /></div>
        <div className="oc-loading-list">
          {Array.from({ length: Math.min(count, 8) }, (_, index) => <LoadingRow key={index} index={index} />)}
        </div>
      </div>}
      {layout === "workspace" && <div className="oc-loading-workspace">
        <div className="oc-loading-preview-heading"><Skeleton className="h-9 w-52 max-w-full" /><Skeleton className="h-9 w-28 rounded-lg" /></div>
        <div className="oc-loading-workspace-columns">
          <div className="oc-loading-workspace-main"><Skeleton className="h-5 w-36" />{Array.from({ length: Math.min(count, 6) }, (_, index) => <LoadingRow key={index} index={index} />)}</div>
          <div className="oc-loading-workspace-aside"><Skeleton className="h-5 w-32" /><Skeleton className="mt-6 h-4 w-3/5" /><Skeleton className="mt-3 h-3 w-4/5" /><Skeleton className="mt-7 h-16 w-full rounded-xl" /></div>
        </div>
      </div>}
    </div>
  </div>
}

function LoadingRow({ index }: { index: number }) {
  return <div className="oc-loading-row">
    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
    <div className="oc-loading-row-copy"><Skeleton className={index % 2 ? "h-4 w-2/5" : "h-4 w-3/5"} /><Skeleton className="mt-3 h-3 w-4/5" /></div>
    <Skeleton className="oc-loading-row-action h-5 w-16 rounded-md" />
  </div>
}
