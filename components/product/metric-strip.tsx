import type { ReactNode } from "react"

export function MetricStrip({ items, label }: { label: string; items: { label: string; value: ReactNode; detail?: string }[] }) {
  return <dl className="oc-metric-strip" aria-label={label}>{items.map(item => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.value}</dd>{item.detail && <p>{item.detail}</p>}
  </div>)}</dl>
}
