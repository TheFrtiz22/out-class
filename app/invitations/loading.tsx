import { LoadingState } from "@/components/ui/loading-state"

export default function Loading() {
  return <LoadingState label="Checking your invitations…" layout="feed" rows={3} />
}
