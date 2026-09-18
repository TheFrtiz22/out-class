import { Check, X } from "lucide-react"
import type { Application } from "@/lib/data"
import { cn } from "@/lib/utils"

const STEPS = ["Applied", "1st Round", "2nd Round", "Decision"] as const

export function ApplicationStatusStepper({ app }: { app: Application }) {
  const stageIndex = { Draft: -1, Applied: 0, "Round 1": 1, "Round 2": 2, Decision: 3 }[app.stage]
  const rejected = app.stage === "Decision" && app.outcome === "Rejected"
  const accepted = app.stage === "Decision" && app.outcome === "Accepted"

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const isFinal = i === STEPS.length - 1
        const done = i < stageIndex
        const active = i === stageIndex && !isFinal
        const label = isFinal ? (accepted ? "Accepted" : rejected ? "Rejected" : "Decision") : step

        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-neutral-400 bg-foreground text-background",
                  active && "border-neutral-400 bg-secondary text-foreground",
                  accepted && isFinal && "border-success bg-success text-white",
                  rejected && isFinal && "border-destructive bg-destructive text-destructive-foreground",
                  !done && !active && !accepted && !rejected && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : accepted && isFinal ? (
                  <Check className="size-3.5" />
                ) : rejected && isFinal ? (
                  <X className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  active && "text-foreground",
                  accepted && isFinal && "text-success",
                  rejected && isFinal && "text-destructive",
                  !active && !(accepted && isFinal) && !(rejected && isFinal) && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 flex-1 rounded-full",
                  i < stageIndex ? "bg-foreground" : "bg-border",
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
