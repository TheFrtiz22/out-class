"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { memberDate } from "@/components/member-overview"
import { hasPermission } from "@/lib/permissions"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
import { LoadingState } from "@/components/ui/loading-state"
import { Dashboard, DashboardGrid, NeedsAction, NeedsYouRow } from "@/components/product/dashboard/dashboard"
import { needsYou, railHrefs, type NeedsCard } from "@/components/club-home/club-home-model"
import { AssignmentsCard, MembersCard, NextMeetingCard, RecruitingStripLink, TasksCard, TeamPulse, UpdatesCard, WeekCard } from "@/components/club-home/club-home-sections"
import { useRecruitingStrip } from "@/components/club-home/use-recruiting-strip"
import { OrganizationSetupChecklist } from "@/components/organization-setup-checklist"
import { organizationCapabilities } from "@/lib/organization-authorization"
import { useDemoMode } from "@/contexts/demo-context"
import "@/components/club-home/club-home.css"
const Task = dynamic(() => import("@/components/tasks/dashboard-task").then(m => m.DashboardTask), { loading: () => <LoadingState variant="glass" layout="form" rows={2} label="Loading task…" /> })
const Meeting = dynamic(() => import("@/components/events/dashboard-meeting").then(m => m.DashboardMeeting), { loading: () => <LoadingState variant="glass" layout="form" rows={3} label="Loading meeting…" /> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
type Preview = { kind: "task"; id: string; assignmentId?: string; title: string; review?: boolean } | { kind: "meeting" | "announcement"; id: string; title: string }

/** Club home: running the club week to week (meetings, tasks, announcements, members). No recruiting cards:
 * at most one strip links to the Recruiting Overview while a cycle is active. Every section is gated by the
 * overview's own permission-scoped data; links are rail destinations. Members see the same page with less. */
export function ManagerOverview({ data, refreshing = false, onChanged = () => {} }: { data: Overview; refreshing?: boolean; onChanged?: () => void; showRecaps?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const demo = useDemoMode()
  const { operations: op, club } = data
  const hrefs = railHrefs(data.membership, club.id)
  const cards = needsYou(data, hrefs)
  const strip = useRecruitingStrip(club.id, hrefs)
  const announcement = preview?.kind === "announcement" ? op.announcements.find(a => a.id === preview.id) : undefined
  // Drawers read the current overview by id, so a refetch never shows a stale record; a record that
  // disappeared (a withdrawn update) closes its drawer instead of leaving it empty.
  const gone = preview?.kind === "announcement" && !announcement
  const openTask = (id: string, assignmentId: string | undefined, title: string, review?: boolean) => setPreview({ kind: "task", id, assignmentId, title, review })
  const openMeeting = (id: string, title: string) => setPreview({ kind: "meeting", id, title })
  const action = (card: NeedsCard) => {
    const a = card.action
    if (a.kind === "link") return <NeedsAction href={a.href}>{a.label}</NeedsAction>
    return <NeedsAction onClick={() => { if (a.kind === "task") openTask(a.taskId, a.assignmentId, a.title, a.review); else if (a.kind === "meeting") openMeeting(a.meetingId, a.title) }}>{a.label}</NeedsAction>
  }
  const n = cards.length
  return <Dashboard className="oc-club-home" busy={refreshing}>
    {strip && <RecruitingStripLink strip={strip} />}
    <NeedsYouRow headingId="club-home-needs" className="oc-club-home-needs"
      items={cards.map(card => ({ id: card.id, title: card.title, detail: card.detail, progress: card.progress, action: action(card) }))}
      clear={<><strong>You’re clear for now.</strong> Overdue tasks, submissions and meetings that need you will show up here.</>} />
    {!demo.isDemoEnabled && organizationCapabilities(data.membership).canTransferOwnership && <OrganizationSetupChecklist key={club.id} clubId={club.id} compact />}
    <DashboardGrid main={<>
      <NextMeetingCard data={data} hrefs={hrefs} index={n + 1} onOpen={openMeeting} />
      <TasksCard data={data} hrefs={hrefs} index={n + 2} onTask={openTask} />
      <UpdatesCard data={data} hrefs={hrefs} index={n + 3} onOpen={(id, title) => setPreview({ kind: "announcement", id, title })} />
    </>} side={<>
      <WeekCard data={data} hrefs={hrefs} index={n + 2} onMeeting={openMeeting} onTask={(id, assignmentId, title) => openTask(id, assignmentId, title)} />
      <MembersCard data={data} hrefs={hrefs} index={n + 3} />
      <TeamPulse data={data} hrefs={hrefs} index={n + 4} />
      {hasPermission(data.membership, "tasks.manage") && data.work.length > 0 && <AssignmentsCard data={data} hrefs={hrefs} index={n + 5} onOpen={item => openTask(item.task.id, item.id, item.task.title)} />}
    </>} />
    {preview && !gone && <DashboardDrawer title={preview.title} description={preview.kind === "task" ? preview.review ? "Review the submitted work and save feedback." : "Instructions and your saved submission." : preview.kind === "meeting" ? "Meeting agenda, resources, attendance and available actions." : "Announcement delivered to you."} onClose={() => setPreview(null)}>
      {preview.kind === "task" ? <Task key={preview.assignmentId ?? preview.id} clubId={club.id} taskId={preview.id} assignmentId={preview.assignmentId} review={preview.review} onChanged={onChanged} onClose={() => setPreview(null)} />
        : preview.kind === "meeting" ? <Meeting id={preview.id} canRsvp={op.meetings.find(m => m.id === preview.id)?.canRsvp ?? false} onUpdated={onChanged} />
        : announcement && <article className="oc-announcement-detail space-y-4 py-5"><p>{memberDate(announcement.publishedAt)}</p><p className="whitespace-pre-wrap break-words leading-7">{announcement.body}</p></article>}
    </DashboardDrawer>}
  </Dashboard>
}
