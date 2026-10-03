import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export function MetricStrip({ items, label, density = "compact" }: { label: string; density?: "compact" | "roomy"; items: { label: string; value: ReactNode; detail?: string; href?: string; action?: string }[] }) {
  return <dl className="oc-metric-strip" data-density={density} aria-label={label}>{items.map(item => <div key={item.label}>
    <dt>{item.href ? <Link href={item.href} aria-label={item.action || item.label}>{item.label}<ArrowUpRight aria-hidden="true" size={13} /></Link> : item.label}</dt><dd>{item.value}</dd>{item.detail && <p>{item.detail}</p>}
  </div>)}</dl>
}
