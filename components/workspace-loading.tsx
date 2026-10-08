import { LoadingState } from "@/components/ui/loading-state"

export function WorkspaceLoading({ label = "Loading workspace…", rows = 4 }: { label?: string; rows?: number }) {
  return <LoadingState label={label} rows={rows} />
}
