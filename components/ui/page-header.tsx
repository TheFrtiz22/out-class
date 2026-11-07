import type { ReactNode, Ref } from "react"
import { cn } from "@/lib/utils"

/**
 * The page title for every product, focus and public page: the only place a page's <h1> is
 * rendered (tests/primitives.test.cjs lists the few display/document headings that are not pages).
 * `titleRef` and `focusable` let a screen move focus to the title after navigation.
 * `status` sits beside the title (e.g. the Applications open/closed pill on club Overview).
 */
export function PageHeader({ title, eyebrow, description, action, status, density = "compact", className, titleId, titleRef, focusable = false }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; action?: ReactNode; status?: ReactNode; density?: "compact" | "expressive" | "editorial"; className?: string
  titleId?: string; titleRef?: Ref<HTMLHeadingElement>; focusable?: boolean
}) {
  const heading = <h1 id={titleId} ref={titleRef} tabIndex={focusable ? -1 : undefined} className={focusable ? "outline-none" : undefined}>{title}</h1>
  // A div, not <header>: inside main a header has no landmark role, and outside main it would add a stray banner.
  return <div data-slot="page-header" className={cn("oc-page-header", className)} data-density={density}>
    <div className="oc-page-header-copy">
      {eyebrow && <p className="oc-eyebrow">{eyebrow}</p>}
      {status ? <div className="oc-page-title-row">{heading}{status}</div> : heading}
      {description && <p className="oc-page-description">{description}</p>}
    </div>
    {action && <div className="oc-page-header-action">{action}</div>}
  </div>
}
