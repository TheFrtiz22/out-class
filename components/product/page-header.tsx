import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CampusIllustration } from "./campus-illustration"
import type { CampusIllustrationVariant, CampusIllustrationOptions } from "@/lib/campus-illustrations"

export function PageHeader({ title, eyebrow, description, action, illustration, density = "compact", className }: {
  illustration?: CampusIllustrationVariant | CampusIllustrationOptions;
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; ribbon?: boolean; density?: "compact" | "expressive"; className?: string
}) {
  return <header className={cn("oc-page-header", className)} data-density={density} data-illustrated={illustration ? "true" : undefined}>
    <div className="oc-page-header-copy">
      {eyebrow && <p className="oc-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="oc-page-description">{description}</p>}
    </div>
    {action && <div className="oc-page-header-action">{action}</div>}
    {illustration && <CampusIllustration {...(typeof illustration === "string" ? { variant: illustration } : illustration)} />}
  </header>
}
