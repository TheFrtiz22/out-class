"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { memberDate } from "@/components/member-overview"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
import { LoadingState } from "@/components/ui/loading-state"
import { Dashboard, DashboardGrid, NeedsAction, NeedsYouRow } from "@/components/product/dashboard/dashboard"
import { needsYou, railHrefs, type NeedsCard } from "@/components/club-home/club-home-model"
import { AssignmentsCard, InterviewsCard, PipelineCard, TeamPulse, UpdatesCard, WeekCard } from "@/components/club-home/club-home-sections"
import "@/components/club-home/club-home.css"
const Task = dynamic(() => import("@/components/tasks/dashboard-task").then(m => m.DashboardTask), { loading: () => <LoadingState variant="glass" layout="form" rows={2} label="Loading assignment…" /> })
const Meeting = dynamic(() => import("@/components/events/dashboard-meeting").then(m => m.DashboardMeeting), { loading: () => <LoadingState variant="glass" layout="form" rows={3} label="Loading meeting…" /> })
const Preparation = dynamic(() => import("@/components/interviews/dashboard-preparation").then(m => m.DashboardPreparation), { loading: () => <LoadingState variant="glass" label="Checking interview panel…" layout="rows" rows={2} /> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Booking = Overview["operations"]["bookings"][number]
type Preview = { kind: "task"; id: string; assignmentId?: string; title: string; review?: boolean } | { kind: "meeting" | "announcement"; id: string; title: string } | { kind: "interview"; id: string; title: string }

/** Club home: what needs this member now, then the club's pipeline, week and updates.
 * Every section is gated by the overview's own permission-scoped data; links are rail destinations. */
export function ManagerOverview({ data, refreshing = false, onChanged = () => {}, showRecaps: _showRecaps = true }: { data: Overview; refreshing?: boolean; onChanged?: () => void; showRecaps?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const { operations: op, club } = data
  const hrefs = railHrefs(data.membership, club.id)
  const cards = needsYou(data, hrefs)
  const announcement = preview?.kind === "announcement" ? op.announcements.find(a => a.id === preview.id) : undefined
  // Drawers read the current overview by id, so a refetch never shows a stale record; a record that
  // disappeared (cancelled booking, withdrawn update) closes its drawer instead of leaving it empty.
  const booking = preview?.kind === "interview" ? op.bookings.find(b => b.id === preview.id) : undefined
  const gone = preview?.kind === "announcement" && !announcement || preview?.kind === "interview" && !booking
  const openBooking = (item: Booking) => setPreview({ kind: "interview", id: item.id, title: "Prepare for interview" })
  const action = (card: NeedsCard) => card.action.kind === "link"
    ? <NeedsAction href={card.action.href}>{card.action.label}</NeedsAction>
    : <NeedsAction onClick={() => { const a = card.action; if (a.kind === "task") setPreview({ kind: "task", id: a.taskId, assignmentId: a.assignmentId, title: a.title, review: a.review }) }}>{card.action.label}</NeedsAction>
  return <Dashboard className="oc-club-home" busy={refreshing}>
    <NeedsYouRow headingId="club-home-needs" className="oc-club-home-needs"
      items={cards.map(card => ({ id: card.id, title: card.title, detail: card.detail, progress: card.progress, action: action(card) }))}
      clear={<><strong>You’re clear for now.</strong> New reviews, interviews and assignments will show up here.</>} />
    <DashboardGrid main={<>
      <PipelineCard data={data} hrefs={hrefs} index={cards.length + 1} />
      <InterviewsCard data={data} hrefs={hrefs} index={cards.length + 2} onOpen={openBooking} />
      <UpdatesCard data={data} hrefs={hrefs} index={cards.length + 3} onOpen={(id, title) => setPreview({ kind: "announcement", id, title })} />
    </>} side={<>
      <WeekCard data={data} hrefs={hrefs} index={cards.length + 2} onMeeting={(id, title) => setPreview({ kind: "meeting", id, title })} onBooking={booking => openBooking(booking)} />
      <TeamPulse data={data} hrefs={hrefs} index={cards.length + 3} />
      <AssignmentsCard data={data} hrefs={hrefs} index={cards.length + 4} onOpen={item => setPreview({ kind: "task", id: item.task.id, assignmentId: item.id, title: item.task.title })} />
    </>} />
    {preview && !gone && <DashboardDrawer title={preview.title} description={preview.kind === "task" ? preview.review ? "Review the submitted work and save feedback." : "Instructions and your saved submission." : preview.kind === "meeting" ? "Meeting agenda, resources and available actions." : preview.kind === "interview" ? "The current panel and your authorized room entry." : "Announcement delivered to you."} onClose={() => setPreview(null)}>
      {preview.kind === "task" ? <Task key={preview.assignmentId ?? preview.id} clubId={club.id} taskId={preview.id} assignmentId={preview.assignmentId} review={preview.review} onChanged={onChanged} onClose={() => setPreview(null)} />
        : preview.kind === "meeting" ? <Meeting id={preview.id} canRsvp={op.meetings.find(m => m.id === preview.id)?.canRsvp ?? false} onUpdated={onChanged} />
        : preview.kind === "interview" ? booking && <Preparation clubId={club.id} booking={booking} member={data.membership} />
        : announcement && <article className="oc-announcement-detail space-y-4 py-5"><p>{memberDate(announcement.publishedAt)}</p><p className="whitespace-pre-wrap break-words leading-7">{announcement.body}</p></article>}
    </DashboardDrawer>}
  </Dashboard>
}
