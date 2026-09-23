import { Skeleton } from "@/components/ui/skeleton"

export function WorkspaceLoading({
  label = "Loading workspace…",
  rows = 4,
}: {
  label?: string
  rows?: number
}) {
  return (
    <div role="status" aria-busy="true" className="space-y-6 py-4">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className="divide-y divide-border border-y border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="hidden h-5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
