"use client"
import { cloneElement, useId, type MouseEvent, type ReactElement, type ReactNode } from "react"
import { ChevronDown } from "@/components/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * One collapsed line in the applicant review: "Interview notes (2)". Content stays mounted while
 * collapsed (so counts load) unless `lazy`, which renders it only once opened (the résumé viewer).
 * Callers hide the whole section when it is empty and the viewer cannot add to it.
 */
export function ReviewSection({ id, title, count, open, onOpenChange, lazy = false, children }: {
  id: string; title: string; count?: number | null; open: boolean; onOpenChange: (open: boolean) => void; lazy?: boolean; children: ReactNode
}) {
  const panel = `${id}-panel`
  return <section className="oc-review-section" data-open={open || undefined} aria-labelledby={`${id}-label`}>
    <h3><button type="button" id={`${id}-label`} className="oc-review-section-toggle" aria-expanded={open} aria-controls={panel} onClick={() => onOpenChange(!open)}>
      <ChevronDown aria-hidden="true" size={14} className="oc-review-section-chevron" />
      <span>{title}</span>{typeof count === "number" && <span className="oc-review-section-count">({count})</span>}
    </button></h3>
    <div id={panel} role="region" aria-labelledby={`${id}-label`} hidden={!open} className="oc-review-section-body">{lazy && !open ? null : children}</div>
  </section>
}

/**
 * A control that a rule blocks: it stays focusable but inert (aria-disabled; a button ignores clicks, a
 * field is read-only), with the reason in a tooltip and in its accessible description. Without a reason
 * the control renders as is. `field` marks inputs and textareas.
 */
export function DisabledReason({ reason, field = false, children }: { reason?: string | false | null; field?: boolean; children: ReactElement<Record<string, unknown>> }) {
  const id = useId()
  if (!reason) return children
  const blocked = field
    ? { "aria-disabled": true, "aria-describedby": id, readOnly: true, disabled: false, "data-blocked": "" }
    : { "aria-disabled": true, "aria-describedby": id, disabled: false, "data-blocked": "", onClick: (event: MouseEvent) => event.preventDefault() }
  return <Tooltip>
    <TooltipTrigger asChild>{cloneElement(children, blocked)}</TooltipTrigger>
    <TooltipContent id={`${id}-tip`} side="top" className="max-w-72">{reason}</TooltipContent>
    <span id={id} className="sr-only">{reason}</span>
  </Tooltip>
}
