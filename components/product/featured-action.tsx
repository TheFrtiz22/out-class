import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One meaningful next action. Content and routing stay with the owning workflow. */
export function FeaturedAction({ id, eyebrow, title, description, action, meta, className }: {
  id: string; eyebrow: ReactNode; title: ReactNode; description: ReactNode
  action: ReactNode; meta?: ReactNode; className?: string
}) {
  return <section className={cn("oc-featured-action", className)} aria-labelledby={id}>
    <div className="oc-featured-action-copy">
      <p className="oc-editorial-label">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="oc-featured-description">{description}</p>
      {meta && <div className="oc-featured-meta">{meta}</div>}
    </div>
    <div className="oc-featured-action-control">{action}</div>
  </section>
}
