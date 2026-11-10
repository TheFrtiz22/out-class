import { cn } from "@/lib/utils"
import { applicationStatusCode, applicationStatusLabel } from "@/lib/application-status"

/**
 * The one application-state pill: Draft, Submitted, In review, Interview, Accepted,
 * Not selected, Waitlisted. Accepts stored codes or legacy labels ("In Review",
 * "Interviewing"); colors come only from semantic tokens (styles/interface-primitives.css).
 */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const code = applicationStatusCode(status)
  return <span data-slot="status-pill" data-status={code} className={cn("oc-status-pill", className)}>{applicationStatusLabel(status)}</span>
}
