import { WorkspaceLoading } from "@/components/workspace-loading"

/** Content-area placeholder: the persistent shell (header, pill, rail) stays on screen during navigation. */
export default function Loading() {
  return <WorkspaceLoading label="Loading your schedule…" layout="schedule" rows={3} />
}
