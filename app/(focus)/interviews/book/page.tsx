import { Suspense } from "react"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { LoadingState } from "@/components/ui/loading-state"
import { BookingLinkPage } from "@/components/interviews/booking-link-page"

export const metadata = { title: "Book your interview", robots: { index: false, follow: false } }

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading your invitation…" layout="calendar" rows={3} />}>
      <AuthSessionBoundary><BookingLinkPage /></AuthSessionBoundary>
    </Suspense>
  )
}
