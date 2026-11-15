"use client"
import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Step<T extends string> = { id: T; label: ReactNode; complete?: boolean; disabled?: boolean; badge?: number }

/**
 * Numbered steps for a sequential workflow: circles joined by a line, a check on finished steps, the
 * current step filled (aria-current="step"). The ordered list announces each step's position. Steps are
 * buttons when `onSelect` is given, otherwise a plain ordered list. On phones only the current step keeps
 * its visible label (the others stay in the accessible name). `badge` shows a count after the label (hidden from
 * assistive tech: put the spoken form in the label).
 */
export function Stepper<T extends string>({ label, steps, current, onSelect, className }: {
  label: string; steps: Step<T>[]; current: T; onSelect?: (id: T) => void; className?: string
}) {
  return <nav aria-label={label} className={cn("oc-stepper", className)} data-slot="stepper">
    <ol>
      {steps.map((step, index) => {
        const active = step.id === current
        const marker = <span className="oc-stepper-marker" aria-hidden="true">{step.complete && !active ? <Check /> : index + 1}</span>
        const badge = step.badge != null && <span className="oc-stepper-badge" aria-hidden="true">{step.badge}</span>
        return <li key={step.id} data-active={active || undefined} data-complete={step.complete || undefined}>
          {onSelect
            ? <button type="button" className="oc-stepper-step" data-step={step.id} aria-current={active ? "step" : undefined} disabled={step.disabled} onClick={() => onSelect(step.id)}>
              {marker}<span className="oc-stepper-label">{step.label}</span>{badge}{step.complete && <span className="sr-only"> (done)</span>}
            </button>
            : <span className="oc-stepper-step" data-step={step.id} aria-current={active ? "step" : undefined}>{marker}<span className="oc-stepper-label">{step.label}</span>{badge}</span>}
        </li>
      })}
    </ol>
  </nav>
}

/** Back / Next under a stepped workflow. Omit a side to hide it (first and last steps). */
export function StepperNav({ onBack, onNext, backLabel = "Back", nextLabel = "Next", nextDisabled, className }: {
  onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string; nextDisabled?: boolean; className?: string
}) {
  if (!onBack && !onNext) return null
  return <div className={cn("oc-stepper-nav", className)} data-slot="stepper-nav">
    {onBack ? <Button type="button" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" />{backLabel}</Button> : <span />}
    {onNext && <Button type="button" onClick={onNext} disabled={nextDisabled}>{nextLabel}<ArrowRight aria-hidden="true" /></Button>}
  </div>
}
