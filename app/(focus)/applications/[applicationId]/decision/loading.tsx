import { LoadingState } from "@/components/ui/loading-state"

export default function Loading() {
  return <LoadingState label="Opening your decision letter…" layout="document" rows={3} />
}
