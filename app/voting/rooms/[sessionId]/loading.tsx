import { LoadingState } from "@/components/ui/loading-state"

export default function Loading() {
  return <LoadingState label="Opening voting workspace…" layout="voting" rows={3} />
}
