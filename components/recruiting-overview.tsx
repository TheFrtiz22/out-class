"use client"

import { DashboardPriorityQueue } from "@/components/product/dashboard-priority-queue"
import type { DashboardAction } from "@/lib/dashboard-actions"
import "@/components/product/dashboard-priority-queue.css"
import "@/components/product/recruitment-command-center.css"
import Link from "next/link"
import { ArrowRight, Users2, Video, CheckCircle2, ShieldCheck } from "@/components/icons"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { managerNavigation } from "@/lib/product-navigation"
import { hasPermission } from "@/lib/permissions"
import "@/components/clubs/recruiting-overview.css"

type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>

export function RecruitingOverview({ data }: { data: Overview }) {
  const { club, membership, recruitment, upcomingInterviews, votingSessions } = data
  const navigation = managerNavigation(membership, club.id, "recruiting")
  const canRead = hasPermission(membership, "applications.review") || hasPermission(membership, "applicants.identify")
  const anonymousOnly = canRead && !hasPermission(membership, "applicants.identify")
  const count = (...statuses: string[]) => recruitment?.filter(row => statuses.includes(row.status)).reduce((total, row) => total + row.count, 0) ?? 0
  const destinations = [
    { id: "applicants", icon: Users2, label: "Review applicants", description: "Read submissions, compare evaluations, and advance your rounds.", value: count("SUBMITTED", "IN_REVIEW"), context: "to review", featured: true },
    { id: "interviews", icon: Video, label: "Open interviews", description: "Prepare interview kits and open your available interview tools.", value: count("INTERVIEWING"), context: "at interview stage", featured: false },
    { id: "decisions", icon: CheckCircle2, label: "Review decisions", description: "Review pending outcomes and record decisions with your club access.", value: count("ACCEPTED", "REJECTED"), context: "final outcomes recorded", featured: false },
  ]
  const route = (id: string) => navigation.find(item => item.id === id)?.href
  const actions: DashboardAction[] = [
    ...(canRead && recruitment && route("applicants") ? [{ id: "applicants", title: "Review pending applications", description: `${count("SUBMITTED")} submitted · ${count("IN_REVIEW")} in review`, urgency: "critical" as const, count: count("SUBMITTED", "IN_REVIEW"), href: route("applicants")! }] : []),
    ...(canRead && recruitment && route("interviews") ? [{ id: "interviews", title: "Check applicants at interview stage", description: "Open the interview tools and confirm the next steps for these applicants.", urgency: "soon" as const, count: count("INTERVIEWING"), href: route("interviews")! }] : []),
    ...(upcomingInterviews !== null && upcomingInterviews > 0 && route("interviews") ? [{ id: "booked-interviews", title: `${upcomingInterviews} upcoming interview booking${upcomingInterviews === 1 ? "" : "s"}`, description: "Scheduled within the next seven days. Open interview tools to prepare.", urgency: "soon" as const, count: upcomingInterviews, href: route("interviews")! }] : []),
    ...(votingSessions?.length && route("decisions") ? [{ id: "voting", title: `${votingSessions.length} open voting session${votingSessions.length === 1 ? "" : "s"}`, description: "Continue an existing voting session in the decisions workspace.", urgency: "soon" as const, count: votingSessions.length, href: route("decisions")! }] : []),
    ...(canRead && recruitment && route("decisions") ? [{ id: "waitlist", title: "Review waitlisted candidates", description: "Inspect existing waitlist records before any decision changes.", urgency: "normal" as const, count: count("WAITLISTED"), href: route("decisions")! }] : []),
  ]
  return <div className="oc-recruiting-overview">
    {anonymousOnly && <p className="oc-recruiting-privacy"><ShieldCheck aria-hidden="true" size={17} />Your overview includes only anonymous rounds available to your review access.</p>}
    <DashboardPriorityQueue actions={actions} title="Recruitment priorities" empty="No applications, interview-stage candidates, or waitlisted cases currently need a follow-up." />
    {canRead && recruitment && <section className="oc-recruitment-pipeline" aria-label="Recruitment pipeline">
      <div className="oc-priority-heading"><h2>Where applicants stand</h2><span>Current statuses</span></div>
      <div className="oc-pipeline-stages">
        {[
          { label: "Submitted", count: count("SUBMITTED"), href: route("applicants") },
          { label: "In review", count: count("IN_REVIEW"), href: route("applicants") },
          { label: "Interview stage", count: count("INTERVIEWING"), href: route("interviews") },
          { label: "Offers", count: count("ACCEPTED"), href: route("decisions") },
          { label: "Waitlisted", count: count("WAITLISTED"), href: route("decisions") },
        ].map(stage => <div key={stage.label} className="oc-pipeline-stage">
          <strong>{stage.count}</strong><span>{stage.label}</span>
          {stage.href && <Link href={stage.href} aria-label={`Open ${stage.label.toLowerCase()} records`}><ArrowRight size={16} aria-hidden="true"/></Link>}
        </div>)}
      </div>
    </section>}
    <nav className="oc-recruiting-shortcuts" aria-label="Recruitment tools">{destinations.map(destination => {
      const target = route(destination.id)
      if (!target) return null
      const Icon = destination.icon
      return <Link href={target} key={destination.id}><Icon size={19} aria-hidden="true"/><span>{destination.label}</span><ArrowRight size={16} aria-hidden="true"/></Link>
    })}</nav>
  </div>
}
