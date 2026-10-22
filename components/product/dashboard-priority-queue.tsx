"use client"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "@/components/icons"
import { prioritizeDashboardActions, type DashboardAction } from "@/lib/dashboard-actions"

export function DashboardPriorityQueue({ actions, title = "What needs your attention", empty = "Nothing needs attention right now." }: {
  actions: DashboardAction[]
  title?: string
  empty?: string
}) {
  const items = prioritizeDashboardActions(actions)
  return <section className="oc-priority-queue" aria-label={title}>
    <div className="oc-priority-heading"><h2>{title}</h2><span>{items.length ? `${items.length} next steps` : "All clear"}</span></div>
    {items.length ? <ol className="oc-priority-list">{items.map((item, i) => <li key={item.id}>
      <Link href={item.href} className="oc-priority-item">
        <span className="oc-priority-number">{String(i + 1).padStart(2, "0")}</span>
        <span className="oc-priority-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
        <span className="oc-priority-urgency" data-urgency={item.urgency}>{item.urgency === "critical" ? "Needs attention" : item.urgency === "soon" ? "Coming up" : "Next"}</span>
        <ArrowRight size={18} aria-hidden="true"/>
      </Link>
    </li>)}</ol> : <div className="oc-priority-empty"><CheckCircle2 size={20} aria-hidden="true"/><p>{empty}</p></div>}
  </section>
}
