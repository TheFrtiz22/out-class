"use client"

import { MetricStrip } from "@/components/product/metric-strip"
import Link from "next/link"
import { ArrowRight, Users2, Video, CheckCircle2, ShieldCheck } from "lucide-react"
import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { managerNavigation } from "@/lib/product-navigation"
import { hasPermission } from "@/lib/permissions"
import "@/components/clubs/recruiting-overview.css"

type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>

export function RecruitingOverview({ data }: { data: Overview }) {
  const { club, membership, recruitment } = data
  const navigation = managerNavigation(membership, club.id, "recruiting")
  const canRead = hasPermission(membership, "applications.review") || hasPermission(membership, "applicants.identify")
  const anonymousOnly = canRead && !hasPermission(membership, "applicants.identify")
  const count = (...statuses: string[]) => recruitment?.filter(row => statuses.includes(row.status)).reduce((total, row) => total + row.count, 0) ?? 0
  const destinations = [
    { id: "applicants", icon: Users2, label: "Review applicants", description: "Read submissions, compare evaluations, and advance your rounds.", value: count("SUBMITTED", "IN_REVIEW"), context: "to review", featured: true },
    { id: "interviews", icon: Video, label: "Open interviews", description: "Prepare interview kits and open your available interview tools.", value: count("INTERVIEWING"), context: "at interview stage", featured: false },
    { id: "decisions", icon: CheckCircle2, label: "Review decisions", description: "Review pending outcomes and record decisions with your club access.", value: count("ACCEPTED", "REJECTED"), context: "final outcomes recorded", featured: false },
  ]
  const tools = navigation.filter(item => item.quiet)
  return <div className="oc-recruiting-overview">
    {anonymousOnly && <p className="oc-recruiting-privacy"><ShieldCheck aria-hidden="true" size={17} />Your overview includes only anonymous rounds available to your review access.</p>}
    {canRead && recruitment && <MetricStrip label="Recruitment status" items={[
      { label: "to review", value: count("SUBMITTED", "IN_REVIEW"), href: navigation.find(item => item.id === "applicants")?.href, action: "Review applicants" },
      { label: "interview stage", value: count("INTERVIEWING"), href: navigation.find(item => item.id === "interviews")?.href, action: "Open interviews" },
      { label: "offers", value: count("ACCEPTED"), href: navigation.find(item => item.id === "decisions")?.href, action: "View recorded decisions" },
      { label: "waitlisted", value: count("WAITLISTED"), href: navigation.find(item => item.id === "decisions")?.href, action: "Review waitlisted applications" },
    ]} />}
    <div className="oc-recruiting-overview-grid">
      {destinations.map(destination => {
        const route = navigation.find(item => item.id === destination.id)
        if (!route?.href) return null
        const Icon = destination.icon
        return <section key={destination.id} className="oc-recruiting-card" data-featured={destination.featured} aria-labelledby={`recruiting-${destination.id}`}>
          <div className="oc-recruiting-card-label"><Icon aria-hidden="true" size={19} /><h2 id={`recruiting-${destination.id}`}>{route.label}</h2></div>
          {canRead && recruitment && <p className="oc-recruiting-context"><strong>{destination.value}</strong> {destination.context}</p>}
          {destination.id === "applicants" && canRead && recruitment && <dl className="oc-recruiting-stage-summary"><div><dt>Submitted</dt><dd>{count("SUBMITTED")}</dd></div><div><dt>In review</dt><dd>{count("IN_REVIEW")}</dd></div></dl>}
          {destination.id === "interviews" && canRead && recruitment && <p className="oc-recruiting-note">Application status count · see interview tools for bookings.</p>}
          {destination.id === "decisions" && canRead && recruitment && <p className="oc-recruiting-note">{count("WAITLISTED")} waitlisted · {count("ACCEPTED")} offers</p>}
          <p className="oc-recruiting-description">{destination.description}</p>
          <Link href={route.href}>{destination.label}<ArrowRight aria-hidden="true" size={17} /></Link>
        </section>
      })}
      {tools.length > 0 && <section className="oc-recruiting-tools" aria-labelledby="recruiting-tools-title">
        <div className="oc-recruiting-card-label"><ShieldCheck aria-hidden="true" size={21} /><h2 id="recruiting-tools-title">Review tools</h2></div>
        <p>Keep review criteria and applicant privacy consistent across your rounds.</p>
        <ul>{tools.map(tool => <li key={tool.id}><Link href={tool.href!}><span><strong>{tool.label}</strong><small>{tool.id === "rules" ? "Preview thresholds and explicitly flag applications. No automatic rejections." : "Manage round privacy and prepared anonymous review content."}</small></span><ArrowRight aria-hidden="true" size={16} /></Link></li>)}</ul>
      </section>}
    </div>
  </div>
}
