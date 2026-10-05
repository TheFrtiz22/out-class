import { Suspense } from "react"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"
import { BookingLinkPage } from "@/components/interviews/booking-link-page"

export default function Page() {
  return (
    <Suspense fallback={<OutClassLoadingScreen />}>
      <AuthSessionBoundary><BookingLinkPage /></AuthSessionBoundary>
    </Suspense>
  )
}
