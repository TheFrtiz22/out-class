import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export type LoadingLayout = "inline" | "rows" | "cards" | "applications" | "applicants" | "workspace" | "form" | "document" | "feed" | "table" | "calendar" | "schedule" | "interview" | "voting" | "presentation"

/**
 * Placeholders follow the shape of the content being fetched, not a generic full-screen
 * spinner. The label is the only announced content; all visual scaffolding is decorative.
 * These are indeterminate loaders: never imply a percent complete or delay real content.
 */
export function LoadingState({
  label = "Loading…",
  layout = "rows",
  rows = 4,
  calendarView = "month",
  className,
}: {
  label?: string
  layout?: LoadingLayout
  rows?: number
  calendarView?: "month" | "week"
  className?: string
}) {
  const count = Math.max(1, Math.min(12, Math.floor(rows) || 4))
  if (layout === "inline") {
    return <div data-slot="loading-state" data-layout="inline" role="status" aria-busy="true" className={cn("oc-loading-state", className)}>
      <LoadingIndicator /><span>{label}</span>
    </div>
  }

  return <div data-slot="loading-state" data-layout={layout} role="status" aria-busy="true" className={cn("oc-loading-state", className)}>
    <span className="sr-only">{label}</span>
    <div className="oc-loading-preview" aria-hidden="true">
      {layout === "feed" && <div className="oc-loading-feed">{Array.from({ length: count }, (_, index) => <div className="oc-loading-feed-item" key={index}>
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" /><div className="min-w-0 flex-1"><Skeleton className="h-4 w-3/5" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="mt-4 h-2 w-20" /></div>
      </div>)}</div>}
      {layout === "table" && <div className="oc-loading-table">
        <div className="oc-loading-table-head"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-12" /></div>
        {Array.from({ length: count }, (_, index) => <div className="oc-loading-table-row" key={index}><div className="flex min-w-0 items-center gap-3"><Skeleton className="size-9 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><Skeleton className="h-3 w-3/4" /><Skeleton className="mt-2 h-2 w-1/2" /></div></div><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-6 w-12 max-w-full rounded-md" /></div>)}
      </div>}
      {layout === "calendar" && <div className="oc-loading-calendar" data-calendar-view={calendarView}>
        <div className="oc-loading-preview-heading"><Skeleton className="h-6 w-36" /><Skeleton className="h-8 w-20" /></div>
        <div className="oc-loading-calendar-grid">{calendarView === "week" && <span />}{Array.from({ length: 7 }, (_, index) => <Skeleton className="mx-auto mb-3 h-3 w-5" key={`day-${index}`} />)}{Array.from({ length: calendarView === "week" ? 8 : 5 }, (_, row) => <div className="contents" key={row}>{calendarView === "week" && <Skeleton className="mt-3 h-2 w-6" />}{Array.from({ length: 7 }, (_, column) => <div className="oc-loading-calendar-cell" key={column}>{calendarView === "month" && <Skeleton className="h-3 w-4" />}{(row + column) % 5 === 2 && <Skeleton className="mt-3 h-5 w-full rounded-sm" />}</div>)}</div>)}</div>
      </div>}
      {layout === "schedule" && <div className="oc-loading-schedule">{Array.from({ length: Math.min(count, 6) }, (_, index) => <div className="oc-loading-schedule-row" key={index}><div><Skeleton className="h-3 w-10" /><Skeleton className="mt-3 h-7 w-9" /></div><div className="min-w-0 flex-1"><Skeleton className="h-4 w-3/5" /><Skeleton className="mt-3 h-3 w-4/5" /><Skeleton className="mt-3 h-3 w-2/5" /></div><Skeleton className="oc-loading-row-action h-8 w-24" /></div>)}</div>}
      {layout === "interview" && <div className="oc-loading-interview">
        <div className="oc-loading-interview-header"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-52 max-w-full" /><Skeleton className="h-8 w-20" /><Skeleton className="ml-auto h-9 w-36" /></div>
        <div className="oc-loading-interview-presence"><Skeleton className="h-3 w-32" /></div>
        <div className="oc-loading-interview-columns">
          <aside className="oc-loading-interview-applicant"><div className="flex items-center gap-4"><Skeleton className="h-28 w-24 shrink-0" /><Skeleton className="h-4 w-2/5" /></div><Skeleton className="mt-7 h-56 w-full" /></aside>
          <div className="oc-loading-interview-questions"><div className="flex items-center justify-between gap-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-20" /></div><Skeleton className="mt-6 h-3 w-28" />{Array.from({ length: Math.min(count, 3) }, (_, index) => <div className="border-b border-border py-5" key={index}><Skeleton className={index % 2 ? "h-4 w-4/5" : "h-4 w-full"} /></div>)}</div>
          <aside className="oc-loading-interview-notes"><Skeleton className="h-3 w-32" /><Skeleton className="mt-3 h-36 w-full" /><Skeleton className="mt-8 h-3 w-24" /><Skeleton className="mt-8 h-5 w-36" /><Skeleton className="mt-5 h-3 w-4/5" /></aside>
        </div>
      </div>}
      {(layout === "presentation" || layout === "voting") && <div className={cn("oc-loading-presentation", layout === "voting" && "oc-loading-voting")}>
        <div><div className="flex items-center gap-4"><Skeleton className="size-16 shrink-0 rounded-full" /><Skeleton className="h-7 w-2/5" /></div><div className="oc-loading-presentation-fields">{Array.from({ length: Math.min(count, 4) }, (_, index) => <div key={index}><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-4 w-4/5" /><Skeleton className="mt-3 h-3 w-3/5" /></div>)}</div></div>
        {layout === "voting" && <aside className="oc-loading-ballot"><Skeleton className="h-4 w-24" /><Skeleton className="mt-6 h-16 w-full" /><Skeleton className="mt-3 h-16 w-full" /><Skeleton className="mt-5 h-3 w-3/4" /></aside>}
      </div>}
      {layout === "rows" && <div className="oc-loading-rows-preview">
        <div className="oc-loading-preview-heading"><Skeleton className="h-6 w-40 max-w-full" /><Skeleton className="h-4 w-24" /></div>
        <div className="oc-loading-list">{Array.from({ length: count }, (_, index) => <LoadingRow key={index} index={index} />)}</div>
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
        <div className="oc-loading-review-toolbar"><div><Skeleton className="h-5 w-44" /><Skeleton className="mt-3 h-3 w-64 max-w-full" /></div><div className="oc-loading-review-actions">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-10 w-24 rounded-lg" />)}</div></div>
        <div className="oc-loading-applicant-filters"><Skeleton className="h-11 w-28 rounded-lg" /><Skeleton className="oc-loading-applicant-search h-11 rounded-lg" /><Skeleton className="h-10 w-20 rounded-lg" /><Skeleton className="h-10 w-20 rounded-lg" /></div>
        <Skeleton className="mt-2 h-2 w-40" />
        <div className="oc-loading-applicant-sort"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-44 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
        <div className="oc-loading-applicant-table"><div className="oc-loading-applicant-table-head">{[0, 1, 2, 3, 4, 5, 6].map(index => <Skeleton key={index} className="h-3 w-3/5" />)}</div>
          {Array.from({ length: Math.min(count, 8) }, (_, index) => <LoadingApplicantRow key={index} />)}
        </div>
      </div>}
      {layout === "form" && <div className="oc-loading-form">
        <div className="oc-loading-preview-heading"><Skeleton className="h-7 w-52 max-w-full" /><Skeleton className="h-8 w-24 rounded-lg" /></div>
        <div className="oc-loading-form-fields">
          {Array.from({ length: Math.min(count, 4) }, (_, index) => <div key={index} className="oc-loading-form-field">
            <Skeleton className="h-3 w-28" />
            <Skeleton className={index === 1 ? "mt-3 h-24 w-full rounded-xl" : "mt-3 h-11 w-full rounded-lg"} />
          </div>)}
        </div>
        <div className="oc-loading-form-actions"><Skeleton className="h-10 w-28 rounded-lg" /><Skeleton className="h-10 w-36 rounded-lg" /></div>
      </div>}
      {layout === "document" && <div className="oc-loading-document">
        <div className="oc-loading-document-head"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-2/5" /></div>
        <div className="oc-loading-document-paper">
          <Skeleton className="h-4 w-1/4" /><Skeleton className="mt-8 h-9 w-3/5" />
          <Skeleton className="mt-9 h-4 w-1/3" />
          {Array.from({ length: Math.min(count + 2, 7) }, (_, index) => <Skeleton key={index} className={index === count + 1 ? "mt-3 h-3 w-1/2" : "mt-3 h-3 w-full"} />)}
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

function LoadingApplicantRow() {
  return <div className="oc-loading-applicant-record">
    <div className="oc-loading-applicant-identity"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><Skeleton className="h-3 w-3/4" /><Skeleton className="mt-3 h-2 w-full" /></div></div>
    <Skeleton className="oc-loading-applicant-round h-3 w-4/5" />
    {[0, 1, 2].map(index => <Skeleton key={index} className="oc-loading-applicant-detail h-3 w-8" />)}
    <div className="oc-loading-applicant-review"><Skeleton className="h-3 w-3/4" /><Skeleton className="mt-3 h-2 w-full" /></div>
    <Skeleton className="oc-loading-applicant-status h-5 w-16 rounded-md" />
    <Skeleton className="oc-loading-applicant-open h-3 w-28" />
  </div>
}
