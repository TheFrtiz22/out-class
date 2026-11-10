"use client"
import type { ReactNode } from "react"
import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"

export type Step<T extends string> = { id: T; label: ReactNode; complete?: boolean; disabled?: boolean }

/**
 * Numbered steps in the pill language: each step is a pill with its number; the current one is the navy
 * pill with cream text, completed steps show a check. The ordered list announces each step's position. Steps are buttons (aria-current="step") when
 * `onSelect` is given, otherwise a plain ordered list.
 */
export function Stepper<T extends string>({ label, steps, current, onSelect, className }: {
  label: string; steps: Step<T>[]; current: T; onSelect?: (id: T) => void; className?: string
}) {
  return <nav aria-label={label} className={cn("oc-stepper", className)} data-slot="stepper">
    <ol>
      {steps.map((step, index) => {
        const active = step.id === current
        const marker = <span className="oc-stepper-marker" aria-hidden="true">{step.complete && !active ? <Check /> : index + 1}</span>
        return <li key={step.id} data-active={active || undefined} data-complete={step.complete || undefined}>
          {onSelect
            ? <button type="button" className="oc-stepper-step" aria-current={active ? "step" : undefined} disabled={step.disabled} onClick={() => onSelect(step.id)}>
              {marker}{step.label}{step.complete && <span className="sr-only"> (done)</span>}
            </button>
            : <span className="oc-stepper-step" aria-current={active ? "step" : undefined}>{marker}{step.label}</span>}
        </li>
      })}
    </ol>
  </nav>
}
