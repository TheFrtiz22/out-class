"use client"
import { ArrowRight } from "@/components/icons"
import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { dashboardDeadlineState } from "@/lib/dashboard-actions"
import { hasPermission } from "@/lib/permissions"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { memberDate } from "@/components/member-overview"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
import { Button } from "@/components/ui/button"
import "@/components/product/operational-dashboard.css"
const Task = dynamic(() => import("@/components/tasks/dashboard-task").then(m => m.DashboardTask), { loading: () => <p role="status">Loading assignment…</p> })
const Meeting = dynamic(() => import("@/components/events/dashboard-meeting").then(m => m.DashboardMeeting), { loading: () => <p role="status">Loading meeting…</p> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Preview = { kind: "task"; id: string; assignmentId?: string; title: string; review?: boolean } | { kind: "meeting" | "announcement"; id: string; title: string }
export function ManagerOverview({ data, refreshing = false, onChanged = () => {}, showRecaps: _showRecaps = true }: { data: Overview; refreshing?: boolean; onChanged?: () => void; showRecaps?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null), [filter, setFilter] = useState("all")
  const { operations: op, work, club, membership } = data
  const manage = hasPermission(membership, "tasks.manage")
  const now = +new Date(op.asOf), overdue = (due: Date | string | null) => dashboardDeadlineState(due, true, now) === "urgent"
  const filtered = work.filter(item => filter !== "overdue" || overdue(item.task.dueAt))
  const announcement = op.announcements.find(a => a.id === preview?.id)
  return <div className="oc-command-center">
    <div className="oc-command-context"><div><p className="oc-command-eyebrow">Daily club work</p><h2>{op.tasks.overdue ? `${op.tasks.overdue} assignment${op.tasks.overdue === 1 ? " is" : "s are"} overdue` : work.length ? "Your next obligations" : "Your work is up to date"}</h2><p>{op.tasks.completed} of {op.tasks.assigned} personal task assignments reviewed · {manage ? `${op.tasks.awaitingReview ?? 0} team submissions awaiting review` : "Your assignments and club updates"}</p></div><Button variant="ghost" disabled={refreshing} onClick={onChanged}>{refreshing ? "Refreshing…" : "Refresh overview"}</Button></div>
    <div className="oc-command-columns"><div>
      <section className="oc-command-section" aria-labelledby="dashboard-work"><header><h2 id="dashboard-work">Your work</h2><div role="group" aria-label="Filter your work"><Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Upcoming</Button><Button size="sm" variant={filter === "overdue" ? "secondary" : "ghost"} aria-pressed={filter === "overdue"} onClick={() => setFilter("overdue")}>Overdue</Button></div></header>
        {filtered.length ? <ul className="oc-command-list">{filtered.map(({ id, task }) => <li key={id}><button className="oc-command-row" onClick={() => setPreview({ kind: "task", id: task.id, assignmentId: id, title: task.title })}><span><strong>{task.title}</strong><small>{task.kind === "PROJECT" ? "Project · view instructions" : "Your response is needed · open to submit"}</small></span><span className="oc-command-date" data-urgent={overdue(task.dueAt)}>{task.dueAt ? `${overdue(task.dueAt) ? "Overdue · " : "Due "}${memberDate(task.dueAt)}` : "No deadline"}</span></button></li>)}</ul> : <p className="oc-command-empty">{filter === "overdue" ? "No overdue assignments in this preview." : "No outstanding assignments. New work will appear here."}</p>}
        <Link className="oc-command-link" href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=mine`}>All your work & feedback <ArrowRight aria-hidden="true" size={14} /></Link>
      </section>
      {manage && op.reviewWork.length > 0 && <section className="oc-command-section" aria-labelledby="dashboard-review"><header><h2 id="dashboard-review">Submissions to review</h2><span>{op.tasks.awaitingReview} awaiting feedback</span></header><ul className="oc-command-list">{op.reviewWork.map(item => <li key={item.id}><button className="oc-command-row" onClick={() => setPreview({ kind: "task", id: item.task.id, assignmentId: item.id, title: item.task.title, review: true })}><span><strong>{item.task.title}</strong><small>Submitted {memberDate(item.submittedAt!)} · review, approve or request revision</small></span><span>Review <ArrowRight aria-hidden="true" size={14} /></span></button></li>)}</ul></section>}
      {op.announcements.length > 0 && <section className="oc-command-section" aria-labelledby="dashboard-updates"><header><h2 id="dashboard-updates">Club updates</h2></header><ul className="oc-command-list">{op.announcements.map(a => <li key={a.id}><button className="oc-command-row" onClick={() => setPreview({ kind: "announcement", id: a.id, title: a.title })}><span><small>{memberDate(a.publishedAt)}</small><strong>{a.title}</strong><span className="oc-command-excerpt">{a.body}</span></span><span>Read <ArrowRight aria-hidden="true" size={14} /></span></button></li>)}</ul></section>}
      {manage && op.team && op.team.assigned > 0 && <section className="oc-command-section" aria-labelledby="dashboard-team"><header><h2 id="dashboard-team">Team work</h2><Link className="oc-command-link" href={`${clubWorkspaceHref(club.id, "tasks")}&taskView=team`}>Manage assignments <ArrowRight aria-hidden="true" size={14} /></Link></header><p className="text-sm leading-7">{op.team.overdue} overdue assignments · {op.team.reviewed} of {op.team.assigned} reviewed · {op.team.recentSubmissions} submissions in the past seven days</p><p className="oc-command-footnote">All non-draft task assignments in this club. Projects are excluded. No individual rankings.</p></section>}
    </div><aside>
      <section className="oc-command-section" aria-labelledby="dashboard-meetings"><header><h2 id="dashboard-meetings">Meet this week</h2></header>{op.meetings.length ? <ul className="oc-command-list">{op.meetings.map(m => <li key={m.id}><button className="oc-command-row oc-command-stacked" onClick={() => setPreview({ kind: "meeting", id: m.id, title: m.title })}><time dateTime={new Date(m.date).toISOString()}>{memberDate(m.date)}</time><strong>{m.title}</strong><small>{m.location}</small>{m.agenda && <span className="oc-command-excerpt">{m.agenda}</span>}<span>Agenda & resources <ArrowRight aria-hidden="true" size={14} /></span></button></li>)}</ul> : <p className="oc-command-empty">No meetings scheduled in the next seven days.</p>}<Link className="oc-command-link" href={clubWorkspaceHref(club.id, "meetings")}>All meetings <ArrowRight aria-hidden="true" size={14} /></Link></section>
      <p className="oc-command-footnote">Completion means reviewed work, not a submitted response. Counts cover your non-draft task assignments; projects are tracked separately.</p>
    </aside></div>
    {preview && <DashboardDrawer title={preview.title} description={preview.kind === "task" ? preview.review ? "Review the submitted work and save feedback." : "Instructions and your saved submission." : preview.kind === "meeting" ? "Meeting agenda, resources and available actions." : "Announcement delivered to you."} onClose={() => setPreview(null)}>{preview.kind === "task" ? <Task key={preview.assignmentId ?? preview.id} clubId={club.id} taskId={preview.id} assignmentId={preview.assignmentId} review={preview.review} onChanged={onChanged} onClose={() => setPreview(null)} /> : preview.kind === "meeting" ? <Meeting id={preview.id} canRsvp={op.meetings.find(m => m.id === preview.id)?.canRsvp ?? false} onUpdated={onChanged} /> : announcement && <article className="space-y-4 py-5"><p>{memberDate(announcement.publishedAt)}</p><p className="whitespace-pre-wrap break-words leading-7">{announcement.body}</p></article>}</DashboardDrawer>}
  </div>
}
