import { CalendarClock, CheckCircle2, Circle, Clock, Eye, FilePenLine, Send, XCircle } from "@/components/icons"
import type { IconComponent } from "@/components/icons/factory"
import { cn } from "@/lib/utils"
import { applicationStatusCode, applicationStatusLabel, applicationStatusLabels } from "@/lib/application-status"

/** One glyph per application state, so the state reads by shape as well as color. */
const statusIcons: Record<string, IconComponent> = {
  DRAFTING: FilePenLine, SUBMITTED: Send, IN_REVIEW: Eye, INTERVIEWING: CalendarClock,
  ACCEPTED: CheckCircle2, REJECTED: XCircle, WAITLISTED: Clock,
}

/**
 * The one application-state label: a tinted Phosphor icon and plain text, no capsule. Draft,
 * Submitted, In review, Interview, Accepted, Not selected, Waitlisted. Accepts stored codes or legacy
 * labels ("In Review", "Interviewing"); icon colors come only from semantic tokens
 * (styles/interface-primitives.css).
 */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const code = applicationStatusCode(status)
  const Icon = statusIcons[code] ?? Circle
  return <span data-slot="status-pill" data-status={code} className={cn("oc-status-pill", className)}><Icon size={15} />{applicationStatusLabel(status)}</span>
}

export type StatusTone = "neutral" | "active" | "done" | "strong"
const toneIcons: Record<StatusTone, IconComponent> = { neutral: Circle, active: Clock, done: CheckCircle2, strong: CheckCircle2 }

/**
 * A free-text status in the same style (public site samples, setup steps). A label that names an
 * application state ("Interview", "In review") renders exactly as StatusPill; anything else takes
 * its glyph and color from `tone`.
 */
export function StatusMark({ label, tone = "neutral", className }: { label: string; tone?: StatusTone; className?: string }) {
  const code = applicationStatusCode(label)
  if (applicationStatusLabels[code]) return <StatusPill status={code} className={className} />
  const Icon = toneIcons[tone]
  return <span data-slot="status-pill" data-tone={tone} className={cn("oc-status-pill", className)}><Icon size={15} weight={tone === "strong" ? "fill" : "regular"} />{label}</span>
}
