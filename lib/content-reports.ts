import { z } from "zod"

/**
 * User-generated content reports (Terms §6 "Reporting content"; App Store 1.2).
 * Reports reuse the PlatformReport table: its `kind` CHECK allows USER, CLUB, EVENT,
 * CONTENT and SUPPORT, so sub-targets are encoded in `targetId` under CONTENT
 * (`club-image:<clubId>:<index>`, `event-flyer:<eventId>:<flyerId>`,
 * `announcement:<clubId>:<announcementId>`). No schema change is needed.
 */
export const REPORT_REASONS = ["SPAM", "HARASSMENT", "INAPPROPRIATE", "IMPERSONATION", "COPYRIGHT", "OTHER"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
export const reportReasonLabels: Record<ReportReason, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or bullying",
  INAPPROPRIATE: "Inappropriate content",
  IMPERSONATION: "Impersonation",
  COPYRIGHT: "Copyright infringement",
  OTHER: "Something else",
}
export const REPORT_DETAILS_MAX = 1000
export const REPORT_DEDUPE_MS = 24 * 60 * 60 * 1000
export const REPORT_RATE_WINDOW_MS = 60 * 60 * 1000
export const REPORT_RATE_LIMIT = 10
/** Copyright claims follow the notice procedure in the Terms (§6 Reporting content). */
export const TERMS_DMCA_HREF = "/terms#legal-6-reporting-content"
export const REPORT_CONFIRMATION = "Thanks. Our team will review this."
export const REPORT_UNAVAILABLE = "This content can’t be reported right now."

const id = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
export const reportTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("club"), id }).strict(),
  z.object({ type: z.literal("club-image"), clubId: id, index: z.number().int().min(0).max(11) }).strict(),
  z.object({ type: z.literal("event"), id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("event-flyer"), eventId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("student"), clubId: id, applicationId: id }).strict(),
  z.object({ type: z.literal("announcement"), id: z.string().uuid() }).strict(),
])
export type ReportTarget = z.infer<typeof reportTargetSchema>
export const reportInputSchema = z.object({
  target: reportTargetSchema,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX).default(""),
}).strict()

const targetNames: Record<ReportTarget["type"], string> = {
  club: "Club profile", "club-image": "Club gallery image", event: "Event", "event-flyer": "Event flyer", student: "Student profile", announcement: "Club announcement",
}
/** The admin-readable summary stored on the report (10–2000 characters, enforced by the table). */
export function reportSummary(reason: ReportReason, type: ReportTarget["type"], details: string) {
  return [`${reportReasonLabels[reason]} · ${targetNames[type]}`, details.trim()].filter(Boolean).join("\n\n").slice(0, 2000)
}

/** Admin context for a stored report target: a readable label and, where one exists, a link. */
export function reportTargetContext(kind: string, targetId: string): { label: string; href: string | null } {
  const enc = encodeURIComponent
  if (kind === "CLUB") return { label: "Club profile", href: `/club/${enc(targetId)}` }
  if (kind === "EVENT") return { label: "Event", href: `/corkboard?event=${enc(targetId)}` }
  if (kind === "USER") return { label: "Student profile", href: `/platform/users?userId=${enc(targetId)}` }
  if (kind === "CONTENT") {
    const [type, a, b] = targetId.split(":")
    if (type === "club-image" && a) return { label: `Club gallery image ${Number(b) + 1}`, href: `/club/${enc(a)}` }
    if (type === "event-flyer" && a) return { label: "Event flyer", href: `/corkboard?event=${enc(a)}` }
    if (type === "announcement" && a) return { label: "Club announcement", href: `/platform/clubs?clubId=${enc(a)}` }
  }
  return { label: kind === "SUPPORT" ? "Support request" : "Platform content", href: null }
}
