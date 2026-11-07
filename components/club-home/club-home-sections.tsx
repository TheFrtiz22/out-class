"use client"
import Link from "next/link"
import { UserRound } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardCard, DashboardFoot, DashboardQuiet, DateChipList, GlassRow, GlassRowList, MetricTiles, PipelineBars, type MetricTile } from "@/components/product/dashboard/dashboard"
import { memberDate } from "@/components/member-overview"
import { hasPermission } from "@/lib/permissions"
import { interviewEntryHref } from "@/lib/interview-entry"
import { interviewPerson, isOverdue, pipeline, thisWeek, type Overview, type RailHrefs } from "@/components/club-home/club-home-model"

type Booking = Overview["operations"]["bookings"][number]
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
    more={hrefs.applicants ? { href: hrefs.applicants, label: "Open applicants" } : undefined}>
    <PipelineBars stages={model.stages} compactStages={model.stages.slice(1)} />
    {facts.length > 0 && <DashboardFoot>{facts.join(" · ")}</DashboardFoot>}
  </DashboardCard>
}

export function InterviewsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (booking: Booking) => void }) {
  const op = data.operations
  const unscheduled = hasPermission(data.membership, "interviews.manage") && hrefs.interviews ? op.rounds.filter(r => r.needsBooking > 0) : []
  if (!op.bookings.length && !unscheduled.length) return null
  return <DashboardCard id="club-home-interviews" title="Your interviews" index={index} className="oc-club-home-card oc-club-home-interviews"
    more={hrefs.interviews ? { href: hrefs.interviews, label: "Interviews" } : undefined}>
    <GlassRowList>
      {op.bookings.map((booking, i) => { const person = interviewPerson(booking, op.rounds); return <li key={booking.id} className="oc-interview-row">
        <time className="oc-interview-time" dateTime={new Date(booking.slot.startTime).toISOString()}>{time(booking.slot.startTime)}<small>{new Date(booking.slot.startTime).toLocaleDateString([], { weekday: "short" })}</small></time>
        <span className="oc-dashboard-avatar" aria-hidden="true">{person.initials || <UserRound size={16} />}</span>
        <span className="oc-dashboard-row-copy"><strong>{person.label}</strong><small>{[booking.round?.name, booking.slot.location].filter(Boolean).join(" · ")}</small></span>
        {i === 0 && booking.slot.roomId && booking.roundId
          ? <Button size="lg" className="px-3" data-tone="interview" asChild><Link href={interviewEntryHref({ clubId: data.club.id, applicationId: booking.applicationId, roundId: booking.roundId, slotId: booking.slot.id, bookingId: booking.id, roomId: booking.slot.roomId })} aria-label={`Open room: ${person.label}, ${memberDate(booking.slot.startTime)}`}>Open room</Link></Button>
          : <Button size="lg" className="px-3" variant="outline" onClick={() => onOpen(booking)} aria-label={`Prep: ${person.label}, ${memberDate(booking.slot.startTime)}`}>Prep</Button>}
      </li> })}
      {unscheduled.map(round => <li key={round.id} className="oc-interview-row" data-unscheduled="true">
        <span className="oc-interview-time">Not set</span>
        <span className="oc-dashboard-avatar" data-unscheduled="true" aria-hidden="true" />
        <span className="oc-dashboard-row-copy"><strong>{round.needsBooking} without a time</strong><small>{round.name}</small></span>
        <Button size="lg" className="px-3" variant="outline" asChild><Link href={hrefs.interviews!} aria-label={`Find a time: ${round.name}`}>Find a time</Link></Button>
      </li>)}
    </GlassRowList>
  </DashboardCard>
}

export function UpdatesCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (id: string, title: string) => void }) {
  const updates = data.operations.announcements
  if (!updates.length) return null
  return <DashboardCard id="club-home-updates" title="Club updates" index={index} className="oc-club-home-card oc-club-home-updates"
    more={hrefs.announcements ? { href: hrefs.announcements, label: "Announcements" } : undefined}>
    <GlassRowList>{updates.map(update => <li key={update.id}><GlassRow onClick={() => onOpen(update.id, update.title)} title={update.title} detail={update.body}
      lead={<time dateTime={new Date(update.publishedAt).toISOString()}>{new Date(update.publishedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</time>} /></li>)}</GlassRowList>
  </DashboardCard>
}

export function WeekCard({ data, hrefs, index, onMeeting, onBooking }: { data: Overview; hrefs: RailHrefs; index: number; onMeeting: (id: string, title: string) => void; onBooking: (booking: Booking) => void }) {
  const items = thisWeek(data).map(item => {
    const booking = item.bookingId ? data.operations.bookings.find(b => b.id === item.bookingId) : undefined
    return { id: item.id, at: item.at, kind: item.kind, title: item.title, detail: item.detail || undefined,
      onClick: item.meetingId ? () => onMeeting(item.meetingId!, item.title) : booking ? () => onBooking(booking) : undefined }
  })
  return <DashboardCard id="club-home-week" title="This week" index={index} className="oc-club-home-card oc-club-home-week"
    more={hrefs.meetings ? { href: hrefs.meetings, label: "Meetings" } : undefined}>
    <DateChipList items={items} empty="Nothing on the calendar this week." when={memberDate} />
  </DashboardCard>
}

/** Club totals only; no individual rankings. */
export function TeamPulse({ data, hrefs, index }: { data: Overview; hrefs: RailHrefs; index: number }) {
  const team = hasPermission(data.membership, "tasks.manage") ? data.operations.team : null, members = data.members ?? null
  if (!team && !members) return null
  const tiles: MetricTile[] = [
    ...(team ? [{ label: "Overdue", value: team.overdue, urgent: team.overdue > 0 }, { label: "Reviewed", value: team.reviewed, of: team.assigned }, { label: "Submitted this week", value: team.recentSubmissions }] : []),
    ...(members ? [{ label: "Active members", value: members.active }, { label: "Pending invitations", value: members.pendingInvitations }] : []),
  ]
  return <DashboardCard id="club-home-pulse" title="Team pulse" index={index} className="oc-club-home-card oc-club-home-pulse" moreAt="foot"
    more={team && hrefs.tasks ? { href: `${hrefs.tasks}&taskView=team`, label: "Team assignments" } : hrefs.members ? { href: hrefs.members, label: "Members" } : undefined}>
    <MetricTiles items={tiles} />
  </DashboardCard>
}

export function AssignmentsCard({ data, hrefs, index, onOpen }: { data: Overview; hrefs: RailHrefs; index: number; onOpen: (item: Overview["work"][number]) => void }) {
  const now = +new Date(data.operations.asOf)
  const overdue = data.work.filter(item => isOverdue(item.task.dueAt, now))
  const list = (items: Overview["work"], empty: string) => items.length ? <GlassRowList>{items.map(item => <li key={item.id}><GlassRow onClick={() => onOpen(item)}
    lead={<span className="oc-dashboard-dot" data-urgent={isOverdue(item.task.dueAt, now)} aria-hidden="true" />} title={item.task.title}
    detail={item.task.dueAt ? `${isOverdue(item.task.dueAt, now) ? "Overdue · " : "Due "}${memberDate(item.task.dueAt)}` : "No deadline"} /></li>)}</GlassRowList> : <DashboardQuiet>{empty}</DashboardQuiet>
  return <DashboardCard id="club-home-assignments" title="Your assignments" index={index} className="oc-club-home-card oc-club-home-assignments"
    more={hrefs.tasks ? { href: `${hrefs.tasks}&taskView=mine`, label: "All work" } : undefined}>
    {data.work.length ? <Tabs defaultValue="upcoming">
      <TabsList variant="segmented" aria-label="Your assignments"><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="overdue">Overdue{overdue.length ? ` · ${overdue.length}` : ""}</TabsTrigger></TabsList>
      <TabsContent value="upcoming">{list(data.work, "No upcoming assignments.")}</TabsContent>
      <TabsContent value="overdue">{list(overdue, "Nothing overdue.")}</TabsContent>
    </Tabs> : <DashboardQuiet>No assignments right now.</DashboardQuiet>}
  </DashboardCard>
}
