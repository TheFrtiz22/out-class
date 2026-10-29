import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({ title, eyebrow, description, action, density = "compact", className }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; density?: "compact" | "expressive" | "editorial"; className?: string
}) {
  return <header className={cn("oc-page-header", className)} data-density={density}>
    <div className="oc-page-header-copy">
      {eyebrow && <p className="oc-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="oc-page-description">{description}</p>}
    </div>
    {action && <div className="oc-page-header-action">{action}</div>}
  </header>
}
