"use client"
import Link from "next/link"
import { ArrowRight, CalendarDays } from "lucide-react"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { hasPermission } from "@/lib/permissions"
import { memberDate, RecentRecaps } from "@/components/member-overview"

type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
const linkStyle = "inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
export function ManagerOverview({ data }: { data: Overview }) {
  const { club, meeting, work, membership, awaitingReview, recruitment } = data
  const canReview = hasPermission(membership, "applications.review") || hasPermission(membership, "applicants.identify")
  const pending = canReview ? recruitment?.filter(row => ["SUBMITTED", "IN_REVIEW"].includes(row.status)).reduce((sum, row) => sum + row.count, 0) ?? 0 : 0
  const interviews = canReview ? recruitment?.find(row => row.status === "INTERVIEWING")?.count ?? 0 : 0
  const submissions = hasPermission(membership, "tasks.manage") ? awaitingReview ?? 0 : 0
  const operations = [
    ...(submissions > 0 ? [{ title: `${submissions} task submission${submissions === 1 ? "" : "s"} awaiting review`, detail: "Open team tasks to review submitted work and give feedback.", href: `${clubWorkspaceHref(club.id, "tasks")}&taskView=team` }] : []),
    ...(pending > 0 ? [{ title: `${pending} application${pending === 1 ? "" : "s"} in submitted or review status`, detail: hasPermission(membership, "applicants.identify") ? "Open applicants to review the current queue." : "Anonymous rounds only, within your review access.", href: `${clubWorkspaceHref(club.id, "recruitment")}&tool=applicants` }] : []),
    ...(interviews > 0 ? [{ title: `${interviews} application${interviews === 1 ? "" : "s"} at interview stage`, detail: "Check recorded interview details and next steps in Applicants.", href: `${clubWorkspaceHref(club.id, "recruitment")}&tool=applicants` }] : []),
  ]
  return <div className="max-w-6xl space-y-10">
    <div className="max-w-2xl"><h2 className="font-display text-2xl">What needs attention</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">The next meeting, work assigned to you, and club activity you can act on.</p></div>
    {operations.length > 0 && <section aria-labelledby="club-follow-up" className="rounded-xl border bg-card px-5 py-2 sm:px-6"><h3 id="club-follow-up" className="pt-4 text-xs uppercase tracking-widest text-muted-foreground">Ready for follow-up</h3><ul className="divide-y">{operations.map(item => <li key={item.href + item.title}><Link href={item.href} className="flex items-center justify-between gap-5 rounded py-5 focus-visible:outline-2 focus-visible:outline-ring"><div className="min-w-0"><p className="break-words font-medium">{item.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p></div><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" /></Link></li>)}</ul></section>}
    <div className="oc-overview-grid grid items-start gap-5 lg:grid-cols-[1fr_1.15fr]">
      <section aria-labelledby="club-next-meeting"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 id="club-next-meeting" className="font-display text-2xl">Next meeting</h3><Link href={clubWorkspaceHref(club.id, "meetings")} className={linkStyle}>All meetings</Link></div>
        {meeting ? <Link href={`/meetings/${meeting.id}`} className="flex gap-4 rounded-xl border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"><CalendarDays aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{meeting.audience === "MEMBERS" ? "Member meeting" : "Recruitment / Interest"}</p><h4 className="mt-2 break-words text-lg font-semibold">{meeting.title}</h4><p className="mt-4 text-sm">{memberDate(meeting.date)}</p>{meeting.location && <p className="mt-2 break-words text-sm text-muted-foreground">{meeting.location}</p>}<p className="mt-5 text-sm text-primary">Agenda, resources & attendance →</p></div></Link> : <p className="border-y py-6 text-sm leading-7 text-muted-foreground">No upcoming meeting is posted. Past meetings and resources remain available in Meetings.</p>}
      </section>
      <section aria-labelledby="club-your-work"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 id="club-your-work" className="font-display text-2xl">Your outstanding work</h3><Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=mine`} className={linkStyle}>Your tasks</Link></div>
        {work.length > 0 ? <ul className="divide-y border-y">{work.map(item => <li key={item.id}><Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=mine`} className="flex items-center justify-between gap-4 rounded py-5 focus-visible:outline-2 focus-visible:outline-ring"><div className="min-w-0"><p className="text-xs text-muted-foreground">{item.task.kind === "PROJECT" ? "Semester project" : "Task"}</p><h4 className="mt-1 break-words font-medium">{item.task.title}</h4><p className="mt-2 text-sm text-muted-foreground">{item.task.dueAt ? `${+new Date(item.task.dueAt) < Date.now() ? "Overdue · " : "Due "}${memberDate(item.task.dueAt)}` : "No due date"}</p></div><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul> : <p className="border-y py-6 text-sm leading-7 text-muted-foreground">You have no outstanding assignments. Your submissions and feedback remain available in Tasks.</p>}
        {hasPermission(membership, "tasks.manage") && <Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=team`} className={`${linkStyle} mt-4`}>View team tasks & projects →</Link>}
      </section>
    </div>
    <RecentRecaps clubId={club.id} />
  </div>
}
