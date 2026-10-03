"use client"

import { MetricStrip } from "@/components/product/metric-strip"
import { CampusRibbon } from "@/components/product/campus-ribbon"
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
    { id: "applicants", icon: Users2, title: "Find your next class", label: "Review applicants", description: "Read applications, compare evaluations, and move candidates through your rounds.", context: canRead && recruitment ? `${count("SUBMITTED", "IN_REVIEW")} applications in submitted or review status` : "Your review workspace", featured: true },
    { id: "interviews", icon: Video, title: "Make room for a conversation", label: "Open interviews", description: "Prepare your interviews and open the tools available with your access.", context: canRead && recruitment ? `${count("INTERVIEWING")} applications at interview stage · not a booking count` : "Interview preparation", featured: false },
    { id: "decisions", icon: CheckCircle2, title: "Bring the round to a close", label: "Review decisions", description: "Review pending outcomes and recorded decisions. Decision actions follow your club permissions.", context: canRead && recruitment ? `${count("WAITLISTED")} waitlisted · ${count("ACCEPTED", "REJECTED")} final outcomes recorded` : "Application outcomes", featured: false },
  ]
  const tools = navigation.filter(item => item.quiet)
  return <div className="oc-recruiting-overview">
    <p className="oc-recruiting-intro">Thoughtful reviews. Better conversations. A clear next step for {club.name}.</p>
    {anonymousOnly && <p className="oc-recruiting-privacy"><ShieldCheck aria-hidden="true" size={17} />Your overview includes only anonymous rounds available to your review access.</p>}
    {canRead && recruitment && <MetricStrip label="Recruitment status" items={[
      { label: "to review", value: count("SUBMITTED", "IN_REVIEW") },
      { label: "interview stage", value: count("INTERVIEWING") },
      { label: "offers", value: count("ACCEPTED") },
      { label: "waitlisted", value: count("WAITLISTED") },
    ]} />}
    <div className="oc-recruiting-overview-grid">
      {destinations.map(destination => {
        const route = navigation.find(item => item.id === destination.id)
        if (!route?.href) return null
        const Icon = destination.icon
        return <section key={destination.id} className="oc-recruiting-card" data-featured={destination.featured} aria-labelledby={`recruiting-${destination.id}`}>
          {destination.featured && <CampusRibbon />}
          <div className="oc-recruiting-card-label"><Icon aria-hidden="true" size={21} /><span>{route.label}</span></div>
          <h2 id={`recruiting-${destination.id}`}>{destination.title}</h2>
          <p className="oc-recruiting-description">{destination.description}</p>
          <p className="oc-recruiting-context">{destination.context}</p>
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
