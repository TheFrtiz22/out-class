"use client"
import { DashboardPriorityQueue } from "@/components/product/dashboard-priority-queue"
import type { DashboardAction } from "@/lib/dashboard-actions"
import "@/components/product/dashboard-priority-queue.css"
import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin, ListChecks } from "@/components/icons"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { hasPermission } from "@/lib/permissions"
import { memberDate, RecentRecaps } from "@/components/member-overview"

import "@/components/clubs/manager-overview.css"

type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
const linkStyle = "inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
export function ManagerOverview({ data, showRecaps = true }: { data: Overview; showRecaps?: boolean }) {
  const { club, meeting, work, membership, awaitingReview, recruitment, upcomingInterviews, votingSessions } = data
  const canReview = hasPermission(membership, "applications.review") || hasPermission(membership, "applicants.identify")
  const pending = canReview ? recruitment?.filter(row => ["SUBMITTED", "IN_REVIEW"].includes(row.status)).reduce((sum, row) => sum + row.count, 0) ?? 0 : 0
  const interviews = canReview ? recruitment?.find(row => row.status === "INTERVIEWING")?.count ?? 0 : 0
  const submissions = hasPermission(membership, "tasks.manage") ? awaitingReview ?? 0 : 0
  const actions: DashboardAction[] = [
    ...(submissions > 0 ? [{ id: "submitted-tasks", title: `Review ${submissions} task submission${submissions === 1 ? "" : "s"}`, description: "Assess submitted work and provide feedback.", urgency: "critical" as const, count: submissions, href: `${clubWorkspaceHref(club.id, "tasks")}&taskView=team` }] : []),
    ...(pending > 0 ? [{ id: "pending-applicants", title: `Review ${pending} pending application${pending === 1 ? "" : "s"}`, description: hasPermission(membership, "applicants.identify") ? "Open the current applicant review queue." : "Open only rounds available to your anonymous review access.", urgency: "soon" as const, count: pending, href: `${clubWorkspaceHref(club.id, "recruitment")}&tool=applicants` }] : []),
    ...(upcomingInterviews !== null && upcomingInterviews > 0 ? [{ id: "upcoming-interviews", title: `${upcomingInterviews} interview booking${upcomingInterviews === 1 ? "" : "s"} this week`, description: "Prepare for scheduled interviews.", urgency: "soon" as const, count: upcomingInterviews, href: `${clubWorkspaceHref(club.id, "recruitment")}&tool=interviews` }] : []),
    ...(votingSessions?.length ? [{ id: "voting-sessions", title: `${votingSessions.length} open voting session${votingSessions.length === 1 ? "" : "s"}`, description: "Continue voting and confirm round outcomes.", urgency: "soon" as const, count: votingSessions.length, href: `${clubWorkspaceHref(club.id, "recruitment")}&tool=decisions` }] : []),
    ...work.map(item => ({ id: `task-${item.id}`, title: item.task.title, description: item.task.kind === "PROJECT" ? "Your assigned project" : "Your assigned task", urgency: item.task.dueAt && +new Date(item.task.dueAt) < Date.now() ? "critical" as const : "normal" as const, dueAt: item.task.dueAt, href: `${clubWorkspaceHref(club.id, "tasks")}&taskView=mine` })),
    ...(meeting ? [{ id: "meeting", title: `Upcoming: ${meeting.title}`, description: memberDate(meeting.date), urgency: "normal" as const, dueAt: meeting.date, href: `/meetings/${meeting.id}` }] : []),
  ]
  return <div className="oc-manager-overview">
    <DashboardPriorityQueue actions={actions} title="Your next actions" empty="You're caught up. New assignments, meetings, and submissions will appear here." />
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
      {showRecaps && <div className="oc-overview-recaps"><RecentRecaps clubId={club.id} /></div>}
    </div>
  </div>
}
