"use client"

import { Check, X } from "lucide-react"
import { currentStudent, type Application } from "@/lib/data"
import { useClubCustomization } from "@/lib/club-customization"
import { cn } from "@/lib/utils"

/** Recruitment stage IDs stay stable when the club changes their labels or order. */
export function ApplicationStatusStepper({ app }: { app: Pick<Application, "clubId" | "stage" | "outcome"> }) {
  const { state, applicants } = useClubCustomization(app.clubId)
  const applicant = app.clubId === "vvf" ? applicants.find(candidate => candidate.email.toLowerCase() === currentStudent.email.toLowerCase()) : undefined
  const status = app.stage === "Draft" ? "Draft" : applicant?.status ?? app.outcome ?? app.stage
  const rejected = status === "Rejected"
  const accepted = status === "Accepted"
  const steps = [...state.stages, { id: "Decision", name: accepted ? "Accepted" : rejected ? "Rejected" : "Decision" }]
  const stageIndex = accepted || rejected || status === "Decision" ? steps.length - 1 : steps.findIndex(step => step.id === status)

  return <div className="overflow-x-auto py-2">
    <ol aria-label="Recruitment progress" className="flex min-w-max items-start gap-2 font-sans">
      {steps.map((step, index) => {
        const done = index < stageIndex
        const active = index === stageIndex
        return <li key={step.id} aria-current={active ? "step" : undefined} className="flex min-w-24 flex-1 items-center gap-2">
          <div className="flex max-w-40 flex-col items-center gap-2 text-center">
            <span className={cn("flex size-7 items-center justify-center rounded-full border text-xs font-semibold", active ? "border-neutral-900 bg-neutral-900 text-white" : done ? "border-neutral-300 bg-neutral-100 text-neutral-900" : "border-neutral-200 bg-white text-neutral-400")}>
              {active && rejected ? <X className="size-3.5" /> : done || (active && accepted) ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("max-w-36 break-words text-xs", active ? "font-semibold text-neutral-900" : "text-neutral-500")}>{step.name}</span>
          </div>
          {index < steps.length - 1 && <div aria-hidden="true" className={cn("mb-6 h-px min-w-4 flex-1", done ? "bg-neutral-600" : "bg-neutral-200")} />}
        </li>
      })}
    </ol>
  </div>
}
