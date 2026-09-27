"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { listMeetings } from "@/lib/workspace-api"
import { CalendarDays, ArrowRight } from "lucide-react"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { clubWorkspaceHref } from "@/lib/club-workspace"
export type MemberOverviewData = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
export const memberDate = (value: Date | string) => new Date(value).toLocaleString([], { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })

/** Only personal work and permitted meeting data; management summaries stay in the manager workspace. */
export function MemberOverview({ data }: { data: MemberOverviewData }) {
  const { club, meeting, work } = data
  return <div className="max-w-4xl space-y-10">
    <p className="max-w-xl text-sm leading-7 text-muted-foreground">Your next meeting and the work assigned to you. Everything else is one step away in Meetings and Tasks.</p>
    <section aria-labelledby="member-next-meeting">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 id="member-next-meeting" className="font-display text-2xl">Next meeting</h2><Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={clubWorkspaceHref(club.id, "meetings")}>All meetings</Link></div>
      {meeting ? <Link href={`/meetings/${meeting.id}`} className="group flex gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6">
        <CalendarDays aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{meeting.audience === "MEMBERS" ? "Member meeting" : "Recruitment / Interest"}</p><h3 className="mt-2 break-words text-lg font-semibold">{meeting.title}</h3><p className="mt-3 text-sm">{memberDate(meeting.date)}</p>{meeting.location && <p className="mt-1 break-words text-sm text-muted-foreground">{meeting.location}</p>}<p className="mt-5 text-sm text-primary">Agenda, resources & attendance</p></div><ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0" />
      </Link> : <p className="border-y py-6 text-sm leading-7 text-muted-foreground">No upcoming meeting is posted. Past meetings, resources, and available recaps are in Meetings.</p>}
    </section>
    <section aria-labelledby="member-outstanding-work">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 id="member-outstanding-work" className="font-display text-2xl">Your outstanding work</h2><Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={clubWorkspaceHref(club.id, "tasks")}>All tasks</Link></div>
      {work.length ? <ul className="divide-y border-y">{work.map(assignment => <li key={assignment.id}><Link href={clubWorkspaceHref(club.id, "tasks")} className="flex items-center justify-between gap-4 rounded-sm py-5 focus-visible:outline-2 focus-visible:outline-ring"><div className="min-w-0"><p className="text-xs text-muted-foreground">{assignment.task.kind === "PROJECT" ? "Project" : "Task"}</p><h3 className="mt-1 break-words font-medium">{assignment.task.title}</h3><p className="mt-2 text-sm text-muted-foreground">{assignment.task.dueAt ? `${+new Date(assignment.task.dueAt) < Date.now() ? "Overdue · " : "Due "}${memberDate(assignment.task.dueAt)}` : "No due date"}</p></div><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul> : <p className="border-y py-6 text-sm leading-7 text-muted-foreground">You’re up to date. Your submissions and feedback remain available in Tasks.</p>}
    </section>
    <RecentRecaps clubId={club.id} />
  </div>
}

function RecentRecaps({ clubId }: { clubId: string }) {
  const [meetings, setMeetings] = useState<Awaited<ReturnType<typeof listMeetings>> | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    setMeetings(null); setFailed(false)
    listMeetings(clubId).then(value => { if (current) setMeetings(value) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [clubId])
  if (failed) return <p role="status" className="text-sm text-muted-foreground">Recent recaps couldn’t load. <Link className="underline" href={clubWorkspaceHref(clubId, "meetings")}>Open Meetings to try again.</Link></p>
  if (!meetings) return <p role="status" className="text-sm text-muted-foreground">Checking for recent recaps…</p>
  const recent = meetings.filter(m => m.recap?.trim() && +new Date(m.date) <= Date.now()).sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 2)
  if (!recent.length) return null
  return <section aria-labelledby="member-recent-recaps"><h2 id="member-recent-recaps" className="mb-4 font-display text-2xl">Recent recaps</h2><ul className="divide-y border-y">{recent.map(meeting => <li key={meeting.id}><Link href={`/meetings/${meeting.id}`} className="block rounded-sm py-5 focus-visible:outline-2 focus-visible:outline-ring"><p className="text-xs text-muted-foreground">{memberDate(meeting.date)}</p><h3 className="mt-2 font-medium">{meeting.title}</h3><p className="mt-2 line-clamp-2 break-words text-sm leading-7 text-muted-foreground">{meeting.recap}</p><span className="mt-3 inline-block text-sm underline underline-offset-4">Read recap & resources →</span></Link></li>)}</ul></section>
}
