"use client"
import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin, ListChecks, ClipboardCheck } from "lucide-react"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { hasPermission } from "@/lib/permissions"
import { memberDate, RecentRecaps } from "@/components/member-overview"

import "@/components/clubs/manager-overview.css"

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
  return <div className="oc-manager-overview">
    <p className="oc-overview-intro">The next meeting, your outstanding work, and follow-ups that keep {club.name} moving.</p>
    <div className="oc-manager-overview-grid">
      <section className="oc-overview-panel" aria-labelledby="club-next-meeting">
        <header><h2 id="club-next-meeting"><CalendarDays aria-hidden="true" size={20} />Next meeting</h2><Link href={clubWorkspaceHref(club.id, "meetings")} className={linkStyle}>All meetings <ArrowRight aria-hidden="true" size={15} /></Link></header>
        {meeting ? <div className="oc-overview-meeting">
          <span className="oc-overview-audience">{meeting.audience === "MEMBERS" ? "Member meeting" : "Recruitment / Interest"}</span>
          <h3>{meeting.title}</h3>
          <p className="oc-overview-meeting-fact"><CalendarDays aria-hidden="true" size={18} /><time dateTime={new Date(meeting.date).toISOString()}>{memberDate(meeting.date)}</time></p>
          {meeting.location && <p className="oc-overview-meeting-fact"><MapPin aria-hidden="true" size={18} />{meeting.location}</p>}
          <p className="oc-overview-meeting-note">Open the meeting for its agenda, resources, and attendance.</p>
          <Link href={`/meetings/${meeting.id}`} className="oc-overview-meeting-action">View meeting details <ArrowRight aria-hidden="true" size={16} /></Link>
        </div> : <p className="oc-overview-empty">No upcoming meeting is posted. Past meetings and resources remain available in Meetings.</p>}
      </section>
      <section className="oc-overview-panel" aria-labelledby="club-your-work">
        <header><h2 id="club-your-work"><ListChecks aria-hidden="true" size={20} />Your outstanding work</h2><Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=mine`} className={linkStyle}>Your tasks <ArrowRight aria-hidden="true" size={15} /></Link></header>
        {work.length > 0 ? <ul className="oc-overview-work">{work.map(item => <li key={item.id}><Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=mine`}>
          <div><h3>{item.task.title}</h3><p>{item.task.kind === "PROJECT" ? "Semester project" : "Task"} · Assigned to you</p></div>
          <span className="oc-overview-due" data-overdue={!!item.task.dueAt && +new Date(item.task.dueAt) < Date.now()}>{item.task.dueAt ? `${+new Date(item.task.dueAt) < Date.now() ? "Overdue · " : "Due "}${memberDate(item.task.dueAt)}` : "No due date"}</span>
        </Link></li>)}</ul> : <p className="oc-overview-empty">You have no outstanding assignments. Your submissions and feedback remain available in Tasks.</p>}
        {hasPermission(membership, "tasks.manage") && <Link href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=team`} className="oc-overview-team-link">View team tasks & projects <ArrowRight aria-hidden="true" size={15} /></Link>}
      </section>
      {operations.length > 0 && <section aria-labelledby="club-follow-up" className="oc-overview-panel oc-overview-follow-up"><header><h2 id="club-follow-up"><ClipboardCheck aria-hidden="true" size={20} />Ready for follow-up</h2></header><ul>{operations.map(item => <li key={item.href + item.title}><Link href={item.href}><div><h3>{item.title}</h3><p>{item.detail}</p></div><ArrowRight aria-hidden="true" size={16} /></Link></li>)}</ul></section>}
      <div className="oc-overview-recaps"><RecentRecaps clubId={club.id} /></div>
    </div>
  </div>
}
