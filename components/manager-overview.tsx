"use client"
import { ArrowRight } from "@/components/icons"
import { useState, type CSSProperties } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { memberDate } from "@/components/member-overview"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
import { LoadingState } from "@/components/ui/loading-state"
import { Card } from "@/components/ui/card"
import { needsYou, railHrefs, type NeedsCard } from "@/components/club-home/club-home-model"
import { AssignmentsCard, InterviewsCard, PipelineCard, TeamPulse, UpdatesCard, WeekCard } from "@/components/club-home/club-home-sections"
import "@/components/product/operational-dashboard.css"
import "@/components/club-home/club-home.css"
const Task = dynamic(() => import("@/components/tasks/dashboard-task").then(m => m.DashboardTask), { loading: () => <LoadingState variant="glass" layout="form" rows={2} label="Loading assignment…" /> })
const Meeting = dynamic(() => import("@/components/events/dashboard-meeting").then(m => m.DashboardMeeting), { loading: () => <LoadingState variant="glass" layout="form" rows={3} label="Loading meeting…" /> })
const Preparation = dynamic(() => import("@/components/interviews/dashboard-preparation").then(m => m.DashboardPreparation), { loading: () => <LoadingState variant="glass" label="Checking interview panel…" layout="rows" rows={2} /> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Booking = Overview["operations"]["bookings"][number]
type Preview = { kind: "task"; id: string; assignmentId?: string; title: string; review?: boolean } | { kind: "meeting" | "announcement"; id: string; title: string } | { kind: "interview"; booking: Booking; title: string }

/** Club home: what needs this member now, then the club's pipeline, week and updates.
 * Every section is gated by the overview's own permission-scoped data; links are rail destinations. */
export function ManagerOverview({ data, refreshing = false, onChanged = () => {}, showRecaps: _showRecaps = true }: { data: Overview; refreshing?: boolean; onChanged?: () => void; showRecaps?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const { operations: op, club } = data
  const hrefs = railHrefs(data.membership, club.id)
  const cards = needsYou(data, hrefs)
  const [first, ...rest] = cards
  const announcement = preview?.kind === "announcement" ? op.announcements.find(a => a.id === preview.id) : undefined
  const openBooking = (booking: Booking) => setPreview({ kind: "interview", booking, title: "Prepare for interview" })
  const action = (card: NeedsCard) => card.action.kind === "link"
    ? <Link className="oc-needs-action" href={card.action.href}>{card.action.label} <ArrowRight aria-hidden="true" size={14} /></Link>
    : <button type="button" className="oc-needs-action" onClick={() => { const a = card.action; if (a.kind === "task") setPreview({ kind: "task", id: a.taskId, assignmentId: a.assignmentId, title: a.title, review: a.review }) }}>{card.action.label} <ArrowRight aria-hidden="true" size={14} /></button>
  const body = (card: NeedsCard) => <>
    <p className="oc-needs-title">{first === card && <span className="oc-needs-dot" aria-hidden="true" />}{card.title}</p>
    <p className="oc-needs-detail">{card.detail}</p>
    {card.progress && card.progress.total > 0 && <div className="oc-needs-progress"><span className="oc-needs-progress-track" aria-hidden="true"><span style={{ "--value": `${Math.round(card.progress.done / card.progress.total * 100)}%` } as CSSProperties} /></span><span>{card.progress.done} of {card.progress.total} reviewed</span></div>}
    {action(card)}
  </>
  return <div className="oc-club-home" aria-busy={refreshing}>
    <section className="oc-club-home-needs" aria-labelledby="club-home-needs">
      <div className="oc-club-home-section-head">
        <h2 id="club-home-needs">Needs you</h2>
      </div>
      {first ? <div className="oc-needs-grid" data-count={cards.length}>
        <Card variant="glass-navy" className="oc-needs-card" data-needs={first.id} data-urgent="true" style={{ "--i": 0 } as CSSProperties}>{body(first)}</Card>
        {rest.length > 0 && <ul className="oc-needs-rest">{rest.map((card, index) => <li key={card.id}><Card variant="glass-raised" className="oc-needs-card" data-needs={card.id} style={{ "--i": index + 1 } as CSSProperties}>{body(card)}</Card></li>)}</ul>}
      </div> : <Card variant="glass" className="oc-needs-clear" style={{ "--i": 0 } as CSSProperties}><p><strong>You’re clear for now.</strong> New reviews, interviews and assignments will show up here.</p></Card>}
    </section>
    <div className="oc-club-home-grid">
      <div className="oc-club-home-main">
        <PipelineCard data={data} hrefs={hrefs} index={cards.length + 1} />
        <InterviewsCard data={data} hrefs={hrefs} index={cards.length + 2} onOpen={openBooking} />
        <UpdatesCard data={data} hrefs={hrefs} index={cards.length + 3} onOpen={(id, title) => setPreview({ kind: "announcement", id, title })} />
      </div>
      <div className="oc-club-home-side">
        <WeekCard data={data} hrefs={hrefs} index={cards.length + 2} onMeeting={(id, title) => setPreview({ kind: "meeting", id, title })} onBooking={booking => openBooking(booking)} />
        <TeamPulse data={data} hrefs={hrefs} index={cards.length + 3} />
        <AssignmentsCard data={data} hrefs={hrefs} index={cards.length + 4} onOpen={item => setPreview({ kind: "task", id: item.task.id, assignmentId: item.id, title: item.task.title })} />
      </div>
    </div>
    {preview && <DashboardDrawer title={preview.title} description={preview.kind === "task" ? preview.review ? "Review the submitted work and save feedback." : "Instructions and your saved submission." : preview.kind === "meeting" ? "Meeting agenda, resources and available actions." : preview.kind === "interview" ? "The current panel and your authorized room entry." : "Announcement delivered to you."} onClose={() => setPreview(null)}>
      {preview.kind === "task" ? <Task key={preview.assignmentId ?? preview.id} clubId={club.id} taskId={preview.id} assignmentId={preview.assignmentId} review={preview.review} onChanged={onChanged} onClose={() => setPreview(null)} />
        : preview.kind === "meeting" ? <Meeting id={preview.id} canRsvp={op.meetings.find(m => m.id === preview.id)?.canRsvp ?? false} onUpdated={onChanged} />
        : preview.kind === "interview" ? <Preparation clubId={club.id} booking={preview.booking} member={data.membership} />
        : announcement && <article className="oc-announcement-detail space-y-4 py-5"><p>{memberDate(announcement.publishedAt)}</p><p className="whitespace-pre-wrap break-words leading-7">{announcement.body}</p></article>}
    </DashboardDrawer>}
  </div>
}
