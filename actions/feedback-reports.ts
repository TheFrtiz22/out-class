"use server"
import { randomUUID } from "node:crypto"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { ActionError, actionResult } from "@/lib/action-result"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { limitAction } from "@/lib/rate-limit-action"
import { RATE_LIMITS } from "@/lib/rate-limit"
import {
  FEEDBACK_CONFIRMATION, FEEDBACK_KINDS, FEEDBACK_SCREENSHOT_URL_SECONDS, PLATFORM_REPORT_HOURLY_LIMIT,
  buildFeedbackContext, feedbackInputSchema, feedbackScreenshotPath, feedbackScreenshotRequestSchema, feedbackTargetId, ownsFeedbackScreenshot,
} from "@/lib/feedback-reports"
import { checkFeedbackScreenshot, feedbackScreenshotBucket } from "@/utils/feedback-screenshots"
import { signalAdminReportsChanged } from "@/lib/admin-reports-signal"

const HOUR = 3_600_000
const TOO_MANY = "You’ve sent several reports recently. Try again later."
const INVALID = "Check your report and try again."

/** Signed-in, live accounts only: never a support session or Demo Mode. Identity comes from the session, never the browser. */
async function reporter() {
  const { user, impersonation } = await requireAuth()
  if (impersonation) throw new ActionError("Reports can’t be filed during a support session.", "SUPPORT_SESSION")
  if ((await cookies()).get(DEMO_COOKIE)?.value === "1") throw new ActionError("Reports can’t be sent from Demo Mode.", "DEMO")
  return user
}

async function recentReports(userId: string) {
  return prisma.platformReport.count({ where: { reporterId: userId, createdAt: { gte: new Date(Date.now() - HOUR) } } })
}

async function prepareFeedbackScreenshotCommand(input: unknown) {
  const user = await reporter()
  const parsed = feedbackScreenshotRequestSchema.safeParse(input)
  if (!parsed.success) throw new ActionError("Choose a PNG or JPEG image up to 2 MB.", "INVALID_SCREENSHOT")
  if (!(await limitAction(RATE_LIMITS.feedbackScreenshots, { userId: user.id })).ok || (await recentReports(user.id)) >= PLATFORM_REPORT_HOURLY_LIMIT)
    throw new ActionError(TOO_MANY, "RATE_LIMITED")
  const bucket = await feedbackScreenshotBucket()
  const path = feedbackScreenshotPath(user.id, randomUUID(), parsed.data.mime)
  const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false })
  if (error || !data) throw new ActionError("Couldn’t prepare the screenshot. Try again.", "SCREENSHOT_UNAVAILABLE")
  return { path, url: data.signedUrl }
}

async function submitFeedbackReportCommand(input: unknown) {
  const user = await reporter()
  const parsed = feedbackInputSchema.safeParse(input)
  if (!parsed.success) throw new ActionError(parsed.error.issues.find(i => i.path[0] === "message")?.message ?? INVALID, "INVALID")
  const { kind, message, context, screenshot } = parsed.data
  if (screenshot) {
    if (!ownsFeedbackScreenshot(user.id, screenshot.path, screenshot.mime)) throw new ActionError(INVALID, "INVALID_SCREENSHOT")
    const check = await checkFeedbackScreenshot(await feedbackScreenshotBucket(), screenshot)
    if (check === "unavailable") throw new ActionError("We couldn’t check your screenshot right now. Try again in a minute.", "SCREENSHOT_UNAVAILABLE")
    if (check !== "ok") throw new ActionError("The screenshot didn’t upload correctly. Attach it again.", "INVALID_SCREENSHOT")
  }
  const stored = buildFeedbackContext(context, (await headers()).get("user-agent"), screenshot?.path)
  const report = await prisma.$transaction(async tx => {
    // Serialize one reporter's submissions so the hourly count cannot race (as submitPlatformReport does).
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
    if (await tx.platformReport.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - HOUR) } } }) >= PLATFORM_REPORT_HOURLY_LIMIT)
      throw new ActionError(TOO_MANY, "RATE_LIMITED")
    const row = await tx.platformReport.create({ data: { kind, targetId: feedbackTargetId(stored), reporterId: user.id, summary: message, context: stored } })
    await tx.auditLog.create({ data: { actorId: user.id, action: "platform.report.create", targetId: row.id, details: { kind, screenshot: !!screenshot, result: "success" } } })
    return row
  })
  await signalAdminReportsChanged()
  return { id: report.id, message: FEEDBACK_CONFIRMATION }
}

/** Ask for a one-time upload URL for an optional screenshot (browser-compressed PNG/JPEG, ≤ 2 MB). */
export async function prepareFeedbackScreenshot(input: unknown) {
  return actionResult(() => prepareFeedbackScreenshotCommand(input), "prepareFeedbackScreenshot")
}

/** Send an issue report or feedback to the OutClass team. */
export async function submitFeedbackReport(input: unknown) {
  return actionResult(() => submitFeedbackReportCommand(input), "submitFeedbackReport")
}

async function getFeedbackScreenshotCommand(input: unknown) {
  const actor = await requirePlatformAdmin()
  const { id } = z.object({ id: z.string().uuid() }).strict().parse(input)
  const report = await prisma.platformReport.findUnique({ where: { id }, select: { id: true, kind: true, context: true } })
  const path = report && (FEEDBACK_KINDS as readonly string[]).includes(report.kind) && report.context && typeof report.context === "object" && !Array.isArray(report.context)
    ? (report.context as Record<string, unknown>).screenshotPath : undefined
  if (typeof path !== "string" || !path) throw new ActionError("This report has no screenshot.", "NOT_FOUND")
  const { data, error } = await (await feedbackScreenshotBucket()).createSignedUrl(path, FEEDBACK_SCREENSHOT_URL_SECONDS)
  if (error || !data) throw new ActionError("The screenshot is no longer available.", "NOT_FOUND")
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.report.screenshot.read", targetId: id, details: { result: "success" } } })
  return { url: data.signedUrl }
}

/** Platform admins only: a short-lived signed link to a report's screenshot. Audited. */
export async function getFeedbackScreenshot(input: unknown) {
  return actionResult(() => getFeedbackScreenshotCommand(input), "getFeedbackScreenshot")
}
