import Link from "next/link"
import { getMyAvailability } from "@/actions/availability"
import { MyAvailability } from "@/components/availability/my-availability"
import { PageHeader } from "@/components/product/page-header"
import { OutClassLogo } from "@/components/outclass-logo"
import { onboardingFocus } from "@/lib/onboarding-presentation"

export const metadata = { title: "My Availability | OutClass" }
export default async function AvailabilityPage() {
  const data = await getMyAvailability()
  return <main data-workspace-detail className="mx-auto min-h-svh max-w-6xl px-4 py-8 sm:px-8"><header className="mb-10 flex flex-wrap items-center justify-between gap-4"><Link href="/?workspace=student" aria-label="OutClass dashboard"><OutClassLogo className="h-7 w-auto" /></Link><Link href="/?workspace=student&view=student-profile" className={`inline-flex min-h-11 items-center text-sm underline underline-offset-4 ${onboardingFocus}`}>Back to profile</Link></header><PageHeader eyebrow="Profile → My Availability" title="My Availability" description="One schedule for all your clubs. Keep your usual week here, then make room for the exceptions." /><MyAvailability initial={data.document} rounds={data.rounds} /></main>
}
