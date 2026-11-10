import { History } from "@/components/icons"
import { StatusMark } from "@/components/ui/status-pill"
import { applicationStatusLabel } from "@/lib/application-status"
import type { PriorApplication } from "@/lib/prior-applications"

type Prior = Omit<PriorApplication, "submittedAt"> & { submittedAt: Date | string | null }

function cycleLabel(prior: Prior) {
  if (prior.cycleName) return prior.cycleName
  const at = prior.submittedAt ? new Date(prior.submittedAt) : null
  return at && !Number.isNaN(+at) ? at.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "America/New_York" }) : "An earlier cycle"
}

/** "Spring 2026 (not selected), Fall 2025". The outcome appears only when the server sent it. */
export function priorApplicationsSummary(priors: readonly Prior[]) {
  return priors.map(prior => `${cycleLabel(prior)}${prior.status ? ` (${applicationStatusLabel(prior.status).toLowerCase()})` : ""}`).join(", ")
}

/** Reviewer-only chip. The server returns an empty list whenever the viewer may not see history. */
export function PreviouslyAppliedBadge({ priors, detail = false }: { priors?: readonly Prior[] | null; detail?: boolean }) {
  if (!priors?.length) return null
  const summary = priorApplicationsSummary(priors)
  return <StatusMark label="Previously applied" icon={History} className="oc-previously-applied">
    {detail ? <span className="text-muted-foreground"> · {summary}</span> : <span className="sr-only">: {summary}</span>}
  </StatusMark>
}
