import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({ title, eyebrow, description, action, status, density = "compact", className }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; status?: ReactNode; density?: "compact" | "expressive" | "editorial"; className?: string
}) {
  return <header className={cn("oc-page-header", className)} data-density={density}>
    <div className="oc-page-header-copy">
      {eyebrow && <p className="oc-eyebrow">{eyebrow}</p>}
      {status ? <div className="oc-page-title-row"><h1>{title}</h1>{status}</div> : <h1>{title}</h1>}
      {description && <p className="oc-page-description">{description}</p>}
    </div>
    {action && <div className="oc-page-header-action">{action}</div>}
  </header>
}
