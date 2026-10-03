import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CampusRibbon } from "./campus-ribbon"

export function PageHeader({ title, eyebrow, description, action, ribbon = false, density = "compact", className }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; ribbon?: boolean; density?: "compact" | "expressive"; className?: string
}) {
  return <header className={cn("oc-page-header", className)} data-density={density}>
    <div className="oc-page-header-copy">
      {eyebrow && <p className="oc-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="oc-page-description">{description}</p>}
    </div>
    {action && <div className="oc-page-header-action">{action}</div>}
    {ribbon && <CampusRibbon />}
  </header>
}
