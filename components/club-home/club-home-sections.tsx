"use client"
import type { CSSProperties } from "react"
import Link from "next/link"
import { ArrowRight, UserRound } from "@/components/icons"
import { Panel } from "@/components/ui/panel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { memberDate } from "@/components/member-overview"
import { hasPermission } from "@/lib/permissions"
import { interviewPerson, isOverdue, pipeline, thisWeek, type Overview, type RailHrefs } from "@/components/club-home/club-home-model"

type Booking = Overview["operations"]["bookings"][number]
const time = (value: Date | string) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
const enter = (index: number) => ({ "--i": index }) as CSSProperties

function More({ href, children }: { href: string; children: string }) {
  return <Link className="oc-club-home-more" href={href}>{children} <ArrowRight aria-hidden="true" size={14} /></Link>
}

/** Stage counts from application statuses; bars are decorative, every number is text. */
export function PipelineCard({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const model = pipeline(data.recruitment)
  if (!model || !model.total) return null
  const op = data.operations, max = Math.max(1, ...model.stages.map(s => s.count))
  const dates = [
    ...(op.intake?.applicationDeadline ? [`${op.intake.applicationOpen && +new Date(op.intake.applicationDeadline) > +new Date(op.asOf) ? "Applications close" : "Applications closed"} ${memberDate(op.intake.applicationDeadline)}`] : []),
    ...op.scheduled.slice(0, 1).map(s => `${s.kind === "DECISION" ? "Decisions publish" : "Message scheduled"} ${memberDate(s.scheduledAt)}`),
  ]
  const mobile = model.stages.slice(1)
  const mobileTotal = Math.max(1, mobile.reduce((n, s) => n + s.count, 0))
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-pipeline" style={enter(index)} aria-labelledby="club-home-pipeline">
    <header className="oc-club-home-card-head"><h2 id="club-home-pipeline">Recruiting pipeline</h2>{op.cycles[0] && <span>{op.cycles[0].name}</span>}</header>
    <ol className="oc-pipeline-stages">{model.stages.map(stage => <li key={stage.id} data-tone={stage.tone}>
      <span className="oc-pipeline-stage-label">{stage.label}</span>
      <strong className="oc-club-home-number">{stage.count}</strong>
      <span className="oc-pipeline-track" aria-hidden="true"><span style={{ "--value": `${Math.round(stage.count / max * 100)}%` } as CSSProperties} /></span>
    </li>)}</ol>
    <div className="oc-pipeline-compact" aria-hidden="true">
      <span className="oc-pipeline-compact-bar">{mobile.map(stage => <span key={stage.id} data-tone={stage.tone} style={{ "--value": `${stage.count / mobileTotal * 100}%` } as CSSProperties} />)}</span>
    </div>
    <ul className="oc-pipeline-compact-counts">{mobile.map(stage => <li key={stage.id} data-tone={stage.tone}><strong className="oc-club-home-number">{stage.count}</strong><span>{stage.label}</span></li>)}</ul>
    {(dates.length > 0 || model.declined > 0 || model.waitlisted > 0) && <p className="oc-club-home-foot">{[...dates, ...(model.waitlisted ? [`${model.waitlisted} waitlisted`] : []), ...(model.declined ? [`${model.declined} not accepted`] : [])].join(" · ")}</p>}
    {hrefs.applicants && <More href={hrefs.applicants}>Open applicants</More>}
  </Panel>
}

export function InterviewsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (booking: Booking, next: boolean) => void }) {
  const op = data.operations
  const unscheduled = hasPermission(data.membership, "interviews.manage") && hrefs.interviews ? op.rounds.filter(r => r.needsBooking > 0) : []
  if (!op.bookings.length && !unscheduled.length) return null
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-interviews" style={enter(index)} aria-labelledby="club-home-interviews">
    <header className="oc-club-home-card-head"><h2 id="club-home-interviews">Your interviews</h2>{hrefs.interviews && <More href={hrefs.interviews}>Interviews</More>}</header>
    <ul className="oc-club-home-rows">
      {op.bookings.map((booking, i) => { const person = interviewPerson(booking, op.rounds); return <li key={booking.id} className="oc-interview-row">
        <time className="oc-interview-time" dateTime={new Date(booking.slot.startTime).toISOString()}>{time(booking.slot.startTime)}<small>{new Date(booking.slot.startTime).toLocaleDateString([], { weekday: "short" })}</small></time>
        <span className="oc-club-home-avatar" aria-hidden="true">{person.initials || <UserRound size={16} />}</span>
        <span className="oc-club-home-row-copy"><strong>{person.label}</strong><small>{[booking.round?.name, booking.slot.location].filter(Boolean).join(" · ")}</small></span>
        <Button size="sm" variant={i === 0 ? "glass-primary" : "glass"} data-tone={i === 0 ? "interview" : undefined} onClick={() => onOpen(booking, i === 0)} aria-label={`${i === 0 ? "Open room" : "Prep"}: ${person.label}, ${memberDate(booking.slot.startTime)}`}>{i === 0 ? "Open room" : "Prep"}</Button>
      </li> })}
      {unscheduled.map(round => <li key={round.id} className="oc-interview-row" data-unscheduled="true">
        <span className="oc-interview-time">Not set</span>
        <span className="oc-club-home-avatar" data-unscheduled="true" aria-hidden="true" />
        <span className="oc-club-home-row-copy"><strong>{round.needsBooking} without a time</strong><small>{round.name}</small></span>
        <Button size="sm" variant="glass" asChild><Link href={hrefs.interviews!} aria-label={`Find a time: ${round.name}`}>Find a time</Link></Button>
      </li>)}
    </ul>
  </Panel>
}

export function UpdatesCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (id: string, title: string) => void }) {
  const updates = data.operations.announcements
  if (!updates.length) return null
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-updates" style={enter(index)} aria-labelledby="club-home-updates">
    <header className="oc-club-home-card-head"><h2 id="club-home-updates">Club updates</h2>{hrefs.announcements && <More href={hrefs.announcements}>Announcements</More>}</header>
    <ul className="oc-club-home-rows">{updates.map(update => <li key={update.id}><button type="button" className="oc-club-home-row" onClick={() => onOpen(update.id, update.title)}>
      <time dateTime={new Date(update.publishedAt).toISOString()}>{new Date(update.publishedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</time>
      <span className="oc-club-home-row-copy"><strong>{update.title}</strong><small>{update.body}</small></span>
      <ArrowRight aria-hidden="true" size={14} />
    </button></li>)}</ul>
  </Panel>
}

export function WeekCard({ data, hrefs, index, onMeeting, onBooking }: { data: Overview; hrefs: RailHrefs; index: number; onMeeting: (id: string, title: string) => void; onBooking: (booking: Booking) => void }) {
  const items = thisWeek(data)
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-week" style={enter(index)} aria-labelledby="club-home-week">
    <header className="oc-club-home-card-head"><h2 id="club-home-week">This week</h2>{hrefs.meetings && <More href={hrefs.meetings}>Meetings</More>}</header>
    {items.length ? <ul className="oc-club-home-rows">{items.map(item => {
      const chip = <span className="oc-week-chip" data-kind={item.kind} aria-hidden="true"><span>{item.at.toLocaleDateString([], { month: "short" })}</span><strong>{item.at.getDate()}</strong></span>
      const copy = <span className="oc-club-home-row-copy"><strong>{item.title}</strong><small><time dateTime={item.at.toISOString()}>{memberDate(item.at)}</time>{item.detail ? ` · ${item.detail}` : ""}</small></span>
      const booking = item.bookingId ? data.operations.bookings.find(b => b.id === item.bookingId) : undefined
      return <li key={item.id}>{item.meetingId ? <button type="button" className="oc-club-home-row" onClick={() => onMeeting(item.meetingId!, item.title)}>{chip}{copy}<ArrowRight aria-hidden="true" size={14} /></button>
        : booking ? <button type="button" className="oc-club-home-row" onClick={() => onBooking(booking)}>{chip}{copy}<ArrowRight aria-hidden="true" size={14} /></button>
        : <div className="oc-club-home-row" data-static="true">{chip}{copy}</div>}</li>
    })}</ul> : <p className="oc-club-home-quiet">Nothing on the calendar this week.</p>}
  </Panel>
}

/** Club totals only; no individual rankings. */
export function TeamPulse({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const team = hasPermission(data.membership, "tasks.manage") ? data.operations.team : null, members = data.members ?? null
  if (!team && !members) return null
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-pulse" style={enter(index)} aria-labelledby="club-home-pulse">
    <header className="oc-club-home-card-head"><h2 id="club-home-pulse">Team pulse</h2></header>
    <dl className="oc-pulse-metrics">
      {team && <><div><dt>Overdue</dt><dd className="oc-club-home-number" data-urgent={team.overdue > 0}>{team.overdue}</dd></div>
        <div><dt>Reviewed</dt><dd className="oc-club-home-number">{team.reviewed}<small> / {team.assigned}</small></dd></div>
        <div><dt>Submitted this week</dt><dd className="oc-club-home-number">{team.recentSubmissions}</dd></div></>}
      {members && <><div><dt>Active members</dt><dd className="oc-club-home-number">{members.active}</dd></div>
        <div><dt>Pending invitations</dt><dd className="oc-club-home-number">{members.pendingInvitations}</dd></div></>}
    </dl>
    {team && hrefs.tasks ? <More href={`${hrefs.tasks}&taskView=team`}>Team assignments</More> : hrefs.members ? <More href={hrefs.members}>Members</More> : null}
  </Panel>
}

export function AssignmentsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (item: Overview["work"][number]) => void }) {
  const now = +new Date(data.operations.asOf)
  const overdue = data.work.filter(item => isOverdue(item.task.dueAt, now))
  const list = (items: Overview["work"], empty: string) => items.length ? <ul className="oc-club-home-rows">{items.map(item => <li key={item.id}><button type="button" className="oc-club-home-row" onClick={() => onOpen(item)}>
    <span className="oc-club-home-dot" data-urgent={isOverdue(item.task.dueAt, now)} aria-hidden="true" />
    <span className="oc-club-home-row-copy"><strong>{item.task.title}</strong><small>{item.task.dueAt ? `${isOverdue(item.task.dueAt, now) ? "Overdue · " : "Due "}${memberDate(item.task.dueAt)}` : "No deadline"}</small></span>
    <ArrowRight aria-hidden="true" size={14} />
  </button></li>)}</ul> : <p className="oc-club-home-quiet">{empty}</p>
  return <Panel as="section" variant="glass" className="oc-club-home-card oc-club-home-assignments" style={enter(index)} aria-labelledby="club-home-assignments">
    <header className="oc-club-home-card-head"><h2 id="club-home-assignments">Your assignments</h2>{hrefs.tasks && <More href={`${hrefs.tasks}&taskView=mine`}>All work</More>}</header>
    {data.work.length ? <Tabs defaultValue="upcoming">
      <TabsList variant="segmented" aria-label="Your assignments"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="overdue">Overdue{overdue.length ? ` · ${overdue.length}` : ""}</TabsTrigger></TabsList>
      <TabsContent value="upcoming">{list(data.work, "No upcoming assignments.")}</TabsContent>
      <TabsContent value="overdue">{list(overdue, "Nothing overdue.")}</TabsContent>
    </Tabs> : <p className="oc-club-home-quiet">No assignments right now.</p>}
  </Panel>
}
