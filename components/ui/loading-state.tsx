import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/** Reserve the known layout. Feedback is announced once; skeletons and icons are decorative. */
export function LoadingState({ label = "Loading…", layout = "rows", rows = 4, className }: {
  label?: string; layout?: "inline" | "rows" | "cards"; rows?: number; className?: string
}) {
  const count = Math.max(1, Math.min(12, Math.floor(rows) || 4))
  return <div data-slot="loading-state" data-layout={layout} role="status" aria-busy="true" className={cn("oc-loading-state", className)}>
    {layout === "inline" ? <><LoaderCircle size={16} aria-hidden="true" className="animate-spin" /><span>{label}</span></> : <>
      <span className="sr-only">{label}</span>
      {layout === "rows" && <div className="space-y-3"><Skeleton className="h-5 w-44 max-w-full" /><Skeleton className="h-3 w-64 max-w-full" /></div>}
      <div className={layout === "cards" ? "oc-loading-cards" : "divide-y divide-border border-y border-border"} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => layout === "cards" ? <Skeleton key={index} className="h-56 w-full" /> : <div key={index} className="flex items-center gap-4 py-5">
          <Skeleton className="size-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-3 w-3/5" /></div><Skeleton className="hidden h-5 w-20 sm:block" />
        </div>)}
      </div>
    </>}
  </div>
}
