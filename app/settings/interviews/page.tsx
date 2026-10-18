import Link from "next/link"
import { getMyInterviewPanelSchedule } from "@/actions/official-panel-schedule"
import { PageHeader } from "@/components/product/page-header"
import { MyInterviewPanelSchedule } from "@/components/interviews/my-panel-schedule"
export const metadata={title:"My Interview Schedule | OutClass"}
export default async function InterviewSchedulePage(){const assignments=await getMyInterviewPanelSchedule();return <div className="max-w-5xl space-y-6"><PageHeader eyebrow="My interviews" title="My Interview Schedule" description="Your approved panel assignments across all your clubs."/><MyInterviewPanelSchedule assignments={assignments}/><Link className="inline-flex min-h-11 items-center text-sm underline" href="/settings/availability">Update My Availability</Link></div>}
