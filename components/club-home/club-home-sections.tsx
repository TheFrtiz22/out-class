"use client"
import type { MouseEvent } from "react"
import Link from "next/link"
import { handleClubLink } from "@/lib/workspace-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { ArrowRight, UserRound } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardCard, DashboardFoot, DashboardQuiet, DateChip, DateChipList, GlassRow, GlassRowList, MetricTiles, PipelineBars, type MetricTile } from "@/components/product/dashboard/dashboard"
import { memberDate } from "@/components/member-overview"
import { hasPermission } from "@/lib/permissions"
import { interviewEntryHref } from "@/lib/interview-entry"
import { TERMS } from "@/lib/copy/terms"
import { interviewPerson, isOverdue, pipeline, thisWeek, type Overview, type RailHrefs, recruitingStripText, type RecruitingStrip } from "@/components/club-home/club-home-model"

type Booking = Overview["operations"]["bookings"][number]

/**
 * Link props for a dashboard CTA. A destination inside this club's workspace switches view client-side
 * (handleClubLink, after the leave-page guard) and is never prefetched: Next would fetch an RSC payload
 * the workspace does not use. Other destinations keep Next's default navigation and prefetch.
 */
export function clubLinkProps(clubId: string, href: string) {
  const sameWorkspace = href.split("?")[0] === `/club/${encodeURIComponent(clubId)}/workspace`
  return {
    href, prefetch: sameWorkspace ? false : undefined,
    onClick: (event: MouseEvent<HTMLElement>) => { if (!canLeaveWorkspace()) { event.preventDefault(); return } handleClubLink(event as MouseEvent<HTMLAnchorElement>, href) },
  }
}
const time = (value: Date | string) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

/** Stage counts from application statuses; bars are decorative, every number is text. */
export function PipelineCard({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const model = pipeline(data.recruitment)
  if (!model || !model.total) return null
  const op = data.operations
  const dates = [
    ...(op.intake?.applicationDeadline ? [`${op.intake.applicationOpen && +new Date(op.intake.applicationDeadline) > +new Date(op.asOf) ? "Applications close" : "Applications closed"} ${memberDate(op.intake.applicationDeadline)}`] : []),
    ...op.scheduled.slice(0, 1).map(s => `${s.kind === "DECISION" ? "Decisions publish" : "Message scheduled"} ${memberDate(s.scheduledAt)}`),
  ]
  const facts = [...dates, ...(model.waitlisted ? [`${model.waitlisted} waitlisted`] : []), ...(model.declined ? [`${model.declined} not accepted`] : [])]
  return <DashboardCard id="club-home-pipeline" title="Recruiting pipeline" aside="All cycles" index={index} className="oc-club-home-card oc-club-home-pipeline"
    more={hrefs.applicants ? { ...clubLinkProps(data.club.id, hrefs.applicants), label: "Open applicants" } : undefined}>
    <PipelineBars stages={model.stages} compactStages={model.stages.slice(1)} />
    {facts.length > 0 && <DashboardFoot>{facts.join(" · ")}</DashboardFoot>}
  </DashboardCard>
}

export function InterviewsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (booking: Booking) => void }) {
  const op = data.operations
  const unscheduled = hasPermission(data.membership, "interviews.manage") && hrefs.interviews ? op.rounds.filter(r => r.needsBooking > 0) : []
  if (!op.bookings.length && !unscheduled.length) return null
  return <DashboardCard id="club-home-interviews" title="Your interviews" index={index} className="oc-club-home-card oc-club-home-interviews"
    more={hrefs.interviews ? { ...clubLinkProps(data.club.id, hrefs.interviews), label: "Interviews" } : undefined}>
    <GlassRowList>
      {op.bookings.map((booking, i) => { const person = interviewPerson(booking, op.rounds); return <li key={booking.id} className="oc-interview-row">
        <time className="oc-interview-time" dateTime={new Date(booking.slot.startTime).toISOString()}>{time(booking.slot.startTime)}<small>{new Date(booking.slot.startTime).toLocaleDateString([], { weekday: "short" })}</small></time>
        <span className="oc-dashboard-avatar" aria-hidden="true">{person.initials || <UserRound size={16} />}</span>
        <span className="oc-dashboard-row-copy"><strong>{person.label}</strong><small>{[booking.round?.name, booking.slot.location].filter(Boolean).join(" · ")}</small></span>
        {/* Every booking can open its preparation; the first one with a room can also be entered. */}
        <span className="oc-interview-actions"><Button size="lg" className="px-3" variant="outline" onClick={() => onOpen(booking)} aria-label={`Prep: ${person.label}, ${memberDate(booking.slot.startTime)}`}>Prep</Button>
          {i === 0 && booking.slot.roomId && booking.roundId && <Button size="lg" className="px-3" data-tone="interview" asChild><Link {...clubLinkProps(data.club.id, interviewEntryHref({ clubId: data.club.id, applicationId: booking.applicationId, roundId: booking.roundId, slotId: booking.slot.id, bookingId: booking.id, roomId: booking.slot.roomId }))} aria-label={`Open room: ${person.label}, ${memberDate(booking.slot.startTime)}`}>Open room</Link></Button>}</span>
      </li> })}
      {unscheduled.map(round => <li key={round.id} className="oc-interview-row" data-unscheduled="true">
        <span className="oc-interview-time">Not set</span>
        <span className="oc-dashboard-avatar" data-unscheduled="true" aria-hidden="true" />
        <span className="oc-dashboard-row-copy"><strong>{round.needsBooking} without a time</strong><small>{round.name}</small></span>
        <Button size="lg" className="px-3" variant="outline" asChild><Link {...clubLinkProps(data.club.id, hrefs.interviews!)} aria-label={`Find a time: ${round.name}`}>Find a time</Link></Button>
      </li>)}
    </GlassRowList>
  </DashboardCard>
}

/** The latest three announcements, with New announcement for members who can post. */
export function UpdatesCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (id: string, title: string) => void }) {
  const updates = data.operations.announcements
  const post = hasPermission(data.membership, "meetings.manage") && hrefs.announcements
  if (!updates.length && !post) return null
  return <DashboardCard id="club-home-updates" title={TERMS.announcements} index={index} className="oc-club-home-card oc-club-home-updates" moreAt="foot"
    aside={post ? <Button size="lg" variant="outline" asChild><Link {...clubLinkProps(data.club.id, `${hrefs.announcements}&compose=1`)}>{TERMS.newAnnouncement}</Link></Button> : undefined}
    more={hrefs.announcements ? { ...clubLinkProps(data.club.id, hrefs.announcements), label: "All announcements" } : undefined}>
    {!updates.length ? <DashboardQuiet>No announcements yet.</DashboardQuiet> : <GlassRowList>{updates.map(update => <li key={update.id}><GlassRow onClick={() => onOpen(update.id, update.title)} title={update.title} detail={update.body}
      lead={<time dateTime={new Date(update.publishedAt).toISOString()}>{new Date(update.publishedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</time>} /></li>)}</GlassRowList>}
  </DashboardCard>
}

/** Meetings and task due dates in the next seven days. Club work only: no interviews or recruiting dates. */
export function WeekCard({ data, hrefs, index, onMeeting, onTask }: { data: Overview; hrefs: RailHrefs; index: number; onMeeting: (id: string, title: string) => void; onTask: (taskId: string, assignmentId: string, title: string) => void }) {
  const items = thisWeek(data).map(item => ({ id: item.id, at: item.at, kind: item.kind === "task" ? "deadline" : "meeting", title: item.title, detail: item.detail || undefined,
    onClick: item.meetingId ? () => onMeeting(item.meetingId!, item.title) : item.assignmentId ? () => onTask(item.taskId!, item.assignmentId!, item.title) : undefined }))
  return <DashboardCard id="club-home-week" title="This week" index={index} className="oc-club-home-card oc-club-home-week"
    more={hrefs.meetings ? { ...clubLinkProps(data.club.id, hrefs.meetings), label: "Meetings" } : undefined}>
    <DateChipList items={items} empty="Nothing on the club calendar this week." when={memberDate} />
  </DashboardCard>
}

/** The next meeting, large, then the rest of the next fourteen days as rows. */
export function NextMeetingCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (id: string, title: string) => void }) {
  const [next, ...rest] = data.operations.meetings
  const manage = hasPermission(data.membership, "meetings.manage"), attendance = hasPermission(data.membership, "meetings.attendance")
  if (!next && !manage) return null
  return <DashboardCard id="club-home-meeting" title="Next meeting" index={index} className="oc-club-home-card oc-club-home-meeting" moreAt="foot"
    more={hrefs.meetings ? { ...clubLinkProps(data.club.id, hrefs.meetings), label: "All meetings" } : undefined}>
    {!next ? <div className="oc-dashboard-state"><DashboardQuiet>No meetings in the next two weeks.</DashboardQuiet>{hrefs.meetings && <Button size="lg" variant="outline" asChild><Link {...clubLinkProps(data.club.id, `${hrefs.meetings}&new=1`)}>New meeting</Link></Button>}</div> : <>
      <div className="oc-next-meeting">
        <DateChip at={new Date(next.date)} kind="meeting" />
        <div className="oc-next-meeting-copy">
          <p className="oc-next-meeting-title">{next.title}</p>
          <p className="oc-next-meeting-when"><time dateTime={new Date(next.date).toISOString()}>{memberDate(next.date)}</time>{next.location ? ` · ${next.location}` : ""}</p>
          {next.agenda?.trim() ? <p className="oc-next-meeting-agenda">{next.agenda.trim().split("\n").filter(Boolean).slice(0, 3).join(" · ")}</p> : manage ? <p className="oc-next-meeting-agenda" data-empty="true">No agenda yet.</p> : null}
          {next.canRsvp && <p className="oc-next-meeting-agenda">RSVP open</p>}
        </div>
      </div>
      <div className="oc-next-meeting-actions">
        <Button size="lg" variant="outline" onClick={() => onOpen(next.id, next.title)}>Agenda &amp; resources</Button>
        {attendance && <Button size="lg" variant="outline" onClick={() => onOpen(next.id, next.title)}>Take attendance · QR check-in</Button>}
        {manage && <Button size="lg" variant="ghost" onClick={() => onOpen(next.id, next.title)}>Edit</Button>}
      </div>
      {rest.length > 0 && <GlassRowList className="oc-next-meetings">{rest.map(meeting => <li key={meeting.id}><GlassRow onClick={() => onOpen(meeting.id, meeting.title)} lead={<DateChip at={new Date(meeting.date)} kind="meeting" />} title={meeting.title} detail={<><time dateTime={new Date(meeting.date).toISOString()}>{memberDate(meeting.date)}</time>{meeting.location ? ` · ${meeting.location}` : ""}</>} /></li>)}</GlassRowList>}
    </>}
  </DashboardCard>
}

type TaskTab = "week" | "overdue" | "feedback" | "all"
/** Due this week · Overdue · Awaiting feedback as three count tiles; each opens Tasks with that filter applied
 * (`taskStatus=`). Task managers see the team (per task); everyone else sees their own work. */
export function TasksCard({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number; onTask?: (taskId: string, assignmentId: string | undefined, title: string, review?: boolean) => void }) {
  const op = data.operations, now = +new Date(op.asOf), team = hasPermission(data.membership, "tasks.manage")
  const week = (at: Date | string | null | undefined) => !!at && +new Date(at) >= now && +new Date(at) <= now + 7 * 86_400_000
  const counts: Record<TaskTab, number> = team ? {
    week: op.teamTasks.filter(t => week(t.dueAt)).length,
    overdue: op.teamTasks.filter(t => isOverdue(t.dueAt, now)).length,
    feedback: op.reviewWork.length,
    all: 0,
  } : {
    week: data.work.filter(w => week(w.task.dueAt)).length,
    overdue: data.work.filter(w => isOverdue(w.task.dueAt, now)).length,
    feedback: 0,
    // Members see all their own work here (there is no separate "Your tasks" card for them).
    all: data.work.length,
  }
  const tabs: TaskTab[] = team ? ["week", "overdue", "feedback"] : ["week", "overdue", "all"]
  const label = { week: "Due this week", overdue: "Overdue", feedback: "Awaiting feedback", all: "All tasks" }
  const status = { week: "week", overdue: "overdue", feedback: "review", all: "all" }
  const base = hrefs.tasks ? `${hrefs.tasks}&taskView=${team ? "team" : "mine"}` : null
  return <DashboardCard id="club-home-tasks" title={team ? TERMS.teamTasks : "Tasks"} index={index} className="oc-club-home-card oc-club-home-tasks" moreAt="foot"
    more={base ? { ...clubLinkProps(data.club.id, base), label: team ? "Manage tasks" : "All tasks" } : undefined}>
    <ul className="oc-count-tiles" aria-label={team ? TERMS.teamTasks : TERMS.yourTasks}>
      {tabs.map(id => {
        const content = <><span className="oc-count-tile-value">{counts[id]}</span><span className="oc-count-tile-label">{label[id]}</span></>
        const href = base ? `${base}&taskStatus=${status[id]}` : null
        return <li key={id}>{href
          ? <Link {...clubLinkProps(data.club.id, href)} className="oc-count-tile" data-tone={id === "overdue" && counts[id] > 0 ? "warning" : undefined} aria-label={`${counts[id]} ${label[id].toLowerCase()}, open tasks`}>{content}</Link>
          : <div className="oc-count-tile" data-tone={id === "overdue" && counts[id] > 0 ? "warning" : undefined}>{content}</div>}</li>
      })}
    </ul>
  </DashboardCard>
}

/** Member counts only (same gate as the member directory); zero pending invitations is a useful answer. */
export function MembersCard({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const members = data.members
  if (!members) return null
  return <DashboardCard id="club-home-members" title="Members" index={index} className="oc-club-home-card oc-club-home-members" moreAt="foot"
    more={hrefs.members ? { ...clubLinkProps(data.club.id, hrefs.members), label: "Members" } : undefined}>
    <MetricTiles items={[{ label: "Active", value: members.active }, { label: "Pending invitations", value: members.pendingInvitations }, { label: "New this month", value: members.recent }]} />
  </DashboardCard>
}

/** One slim strip from Club home to the Recruiting Overview while a cycle is active. */
export function RecruitingStripLink({ clubId, strip }: { clubId: string; strip: RecruitingStrip }) {
  return <Link {...clubLinkProps(clubId, strip.href)} className="oc-recruiting-strip" data-tone="interview">
    <span className="oc-recruiting-strip-dot" aria-hidden="true" />
    <span>{strip.open ? "Recruiting is open" : "Recruiting is underway"} · {recruitingStripText(strip)}</span>
    <span className="oc-recruiting-strip-go">Recruiting overview <ArrowRight aria-hidden="true" size={14} /></span>
  </Link>
}

/** Club totals only; no individual rankings. */
export function TeamPulse({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const team = hasPermission(data.membership, "tasks.manage") ? data.operations.team : null
  if (!team) return null
  const tiles: MetricTile[] = [{ label: "Overdue", value: team.overdue, urgent: team.overdue > 0 }, { label: "Reviewed", value: team.reviewed, of: team.assigned }, { label: "Submitted this week", value: team.recentSubmissions }]
  return <DashboardCard id="club-home-pulse" title="Team pulse" index={index} className="oc-club-home-card oc-club-home-pulse" moreAt="foot"
    more={hrefs.tasks ? { ...clubLinkProps(data.club.id, `${hrefs.tasks}&taskView=team`), label: TERMS.teamTasks } : undefined}>
    <MetricTiles items={tiles} />
  </DashboardCard>
}

export function AssignmentsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (item: Overview["work"][number]) => void }) {
  const now = +new Date(data.operations.asOf)
  const overdue = data.work.filter(item => isOverdue(item.task.dueAt, now))
  const list = (items: Overview["work"], empty: string) => items.length ? <GlassRowList>{items.map(item => <li key={item.id}><GlassRow onClick={() => onOpen(item)}
    lead={<span className="oc-dashboard-dot" data-urgent={isOverdue(item.task.dueAt, now)} aria-hidden="true" />} title={item.task.title}
    detail={item.task.dueAt ? `${isOverdue(item.task.dueAt, now) ? "Overdue · " : "Due "}${memberDate(item.task.dueAt)}` : "No deadline"} /></li>)}</GlassRowList> : <DashboardQuiet>{empty}</DashboardQuiet>
  return <DashboardCard id="club-home-assignments" title={TERMS.yourTasks} index={index} className="oc-club-home-card oc-club-home-assignments"
    more={hrefs.tasks ? { ...clubLinkProps(data.club.id, `${hrefs.tasks}&taskView=mine`), label: "All work" } : undefined}>
    {data.work.length ? <Tabs defaultValue="upcoming">
      <TabsList variant="segmented" aria-label={TERMS.yourTasks}><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="overdue">Overdue{overdue.length ? ` · ${overdue.length}` : ""}</TabsTrigger></TabsList>
      <TabsContent value="upcoming">{list(data.work, "No upcoming tasks.")}</TabsContent>
      <TabsContent value="overdue">{list(overdue, "Nothing overdue.")}</TabsContent>
    </Tabs> : <DashboardQuiet>No tasks right now.</DashboardQuiet>}
  </DashboardCard>
}
