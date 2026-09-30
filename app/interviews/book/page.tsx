import { Suspense } from "react"
import { BookingLinkPage } from "@/components/interviews/booking-link-page"
export default function Page() { return <Suspense fallback={<p className="p-8">Loading interview booking…</p>}><BookingLinkPage /></Suspense> }
