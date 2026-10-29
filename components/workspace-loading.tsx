import { LoadingState, type LoadingLayout } from "@/components/ui/loading-state"

/** Match the placeholder geometry to the destination without taking over navigation. */
export function WorkspaceLoading({
  label = "Loading workspace…",
  rows = 4,
  layout = "workspace",
}: {
  label?: string
  rows?: number
  layout?: LoadingLayout
}) {
  return <LoadingState label={label} layout={layout} rows={rows} />
}
