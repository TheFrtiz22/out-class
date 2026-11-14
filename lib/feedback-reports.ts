import { z } from "zod"

/**
 * Issue reports and feedback from signed-in people to the OutClass team. They reuse the
 * PlatformReport table (kinds ISSUE and FEEDBACK) and the admin Reports queue; the row's
 * nullable `context` holds the captured page, device and build details plus an optional
 * screenshot path. Pure helpers only: no I/O, shared by the actions, the dialog and tests.
 */
export const FEEDBACK_KINDS = ["ISSUE", "FEEDBACK"] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const feedbackKindLabels: Record<FeedbackKind, string> = { ISSUE: "Issue", FEEDBACK: "Feedback" }

/** Every PlatformReport filer (support, content, feedback) shares this hourly allowance. */
export const PLATFORM_REPORT_HOURLY_LIMIT = 10
export const FEEDBACK_MESSAGE_MIN = 10
export const FEEDBACK_MESSAGE_MAX = 2000
export const FEEDBACK_PATH_MAX = 500
export const FEEDBACK_TARGET_MAX = 200
export const FEEDBACK_USER_AGENT_MAX = 120
export const FEEDBACK_VERSION_MAX = 40

/** Screenshots: compressed in the browser, then checked again on the server. */
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024
/** The private bucket only accepts these image types, so the browser always encodes one of them. */
export const FEEDBACK_SCREENSHOT_TYPES = ["image/jpeg", "image/png"] as const
export type FeedbackScreenshotType = (typeof FEEDBACK_SCREENSHOT_TYPES)[number]
const extension: Record<FeedbackScreenshotType, string> = { "image/jpeg": "jpg", "image/png": "png" }
/** Reuses the private, server-only task bucket under its own prefix (see docs/feedback-reports.md). */
export const FEEDBACK_SCREENSHOT_BUCKET = "task-submissions"
export const FEEDBACK_SCREENSHOT_PREFIX = "reports"
export const FEEDBACK_SCREENSHOT_URL_SECONDS = 60

export const FEEDBACK_CONFIRMATION = "Thanks. Your report reached the OutClass team."

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

/** Storage folder holding one person's screenshots (removed with their account). */
export function feedbackScreenshotFolder(userId: string) {
  return `${FEEDBACK_SCREENSHOT_PREFIX}/${userId}`
}
export function feedbackScreenshotPath(userId: string, id: string, mime: FeedbackScreenshotType) {
  return `${feedbackScreenshotFolder(userId)}/${id}.${extension[mime]}`
}
/** A path is only accepted back from the browser when the server could have issued it to this person for this type. */
export function ownsFeedbackScreenshot(userId: string, path: string, mime: FeedbackScreenshotType) {
  const folder = feedbackScreenshotFolder(userId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${folder}/${UUID}\\.${extension[mime]}$`).test(path)
}

// Query keys that can carry credentials or one-time codes are dropped, whatever their value.
const SECRET_KEY = /token|code|secret|key|sig|password|passwd|otp|auth|session|state|nonce|ticket|jwt|hash|email/i
// Long opaque path segments (link tokens) are masked; UUIDs and readable slugs stay.
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{24,}$/
const UUID_SEGMENT = new RegExp(`^${UUID}$`, "i")

/**
 * The page a report was sent from: path and query only. The fragment (where auth flows put
 * tokens), credential-like query parameters and opaque link tokens are removed; short-link
 * codes are masked. Anything that is not a same-site path becomes "/".
 */
export function sanitizeReportPath(raw: unknown): string {
  if (typeof raw !== "string") return "/"
  const input = raw.trim().slice(0, 2000)
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return "/"
  let url: URL
  try { url = new URL(input, "https://outclass.invalid") } catch { return "/" }
  if (url.origin !== "https://outclass.invalid") return "/"
  const segments = url.pathname.split("/").map((segment, i, all) => {
    if (!segment) return segment
    if (all[i - 1] === "q" || all[i - 1] === "calendar-feed") return "[code]"
    return OPAQUE_SEGMENT.test(segment) && !UUID_SEGMENT.test(segment) ? "[redacted]" : segment
  })
  const params = new URLSearchParams()
  for (const [key, value] of url.searchParams) if (!SECRET_KEY.test(key) && key.length <= 40) params.append(key, value.slice(0, 100))
  const query = params.toString()
  const path = segments.join("/") + (query ? `?${query}` : "")
  return path.length > FEEDBACK_PATH_MAX ? path.slice(0, FEEDBACK_PATH_MAX) : path
}

/** A coarse, non-identifying device line from the User-Agent header: browser + major version, OS, form factor. */
export function summarizeUserAgent(raw: string | null | undefined): string {
  const ua = (raw ?? "").slice(0, 1000)
  if (!ua) return "Unknown browser"
  const version = (pattern: RegExp) => ua.match(pattern)?.[1]
  const browser =
    /EdgA?\/|Edg\//.test(ua) ? `Edge ${version(/Edg[A-Z]?\/(\d+)/) ?? ""}` :
    /OPR\//.test(ua) ? `Opera ${version(/OPR\/(\d+)/) ?? ""}` :
    /SamsungBrowser\//.test(ua) ? `Samsung Internet ${version(/SamsungBrowser\/(\d+)/) ?? ""}` :
    /Firefox\/|FxiOS\//.test(ua) ? `Firefox ${version(/(?:Firefox|FxiOS)\/(\d+)/) ?? ""}` :
    /CriOS\/|Chrome\//.test(ua) ? `Chrome ${version(/(?:CriOS|Chrome)\/(\d+)/) ?? ""}` :
    /Safari\//.test(ua) ? `Safari ${version(/Version\/(\d+)/) ?? ""}` : "Other browser"
  const os =
    /iPad/.test(ua) ? "iPadOS" : /iPhone|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" :
    /CrOS/.test(ua) ? "ChromeOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" : "Other OS"
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|iPod/.test(ua) ? "phone" : "desktop"
  return `${browser.trim()} on ${os} (${device})`.slice(0, FEEDBACK_USER_AGENT_MAX)
}

/** The server build that received the report. */
export function appVersion(env: Record<string, string | undefined> = process.env) {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim()
  const version = sha ? sha.slice(0, 12) : "local"
  const deployment = env.VERCEL_ENV?.trim()
  return (deployment && deployment !== "production" ? `${version} (${deployment})` : version).slice(0, FEEDBACK_VERSION_MAX)
}

const dimension = z.number().int().min(1).max(20000)
/**
 * What the browser sends. Unknown context keys (a forged user id, email, cookies…) are stripped,
 * not rejected, so a newer client never breaks an older server; every kept field is bounded.
 */
export const feedbackInputSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(FEEDBACK_MESSAGE_MIN, "Add a few more words so we can follow up.").max(FEEDBACK_MESSAGE_MAX),
  context: z.object({
    path: z.string().max(2000).default("/"),
    viewport: z.object({ width: dimension, height: dimension }).strip().optional(),
  }).strip().default({ path: "/" }),
  screenshot: z.object({
    path: z.string().min(1).max(200),
    size: z.number().int().min(1).max(FEEDBACK_SCREENSHOT_MAX_BYTES),
    mime: z.enum(FEEDBACK_SCREENSHOT_TYPES),
  }).strict().optional(),
}).strict()
export type FeedbackInput = z.input<typeof feedbackInputSchema>

export const feedbackScreenshotRequestSchema = z.object({
  size: z.number().int().min(1).max(FEEDBACK_SCREENSHOT_MAX_BYTES),
  mime: z.enum(FEEDBACK_SCREENSHOT_TYPES),
}).strict()

/** Stored on PlatformReport.context. Built only on the server. */
export type FeedbackContext = {
  path: string
  userAgent: string
  viewport: string | null
  appVersion: string
  screenshotPath?: string
}

export function buildFeedbackContext(input: { path: string; viewport?: { width: number; height: number } }, userAgentHeader: string | null | undefined, screenshotPath?: string, env?: Record<string, string | undefined>): FeedbackContext {
  return {
    path: sanitizeReportPath(input.path),
    userAgent: summarizeUserAgent(userAgentHeader),
    viewport: input.viewport ? `${input.viewport.width}×${input.viewport.height}` : null,
    appVersion: appVersion(env),
    ...(screenshotPath ? { screenshotPath } : {}),
  }
}

/** The report's searchable target: the page path without its query. */
export function feedbackTargetId(context: Pick<FeedbackContext, "path">) {
  return (context.path.split("?")[0] || "/").slice(0, FEEDBACK_TARGET_MAX)
}

/** What admins see: the captured details, never the storage path itself. */
export type AdminReportContext = { path: string; userAgent: string; viewport: string | null; appVersion: string; hasScreenshot: boolean }
export function adminReportContext(value: unknown): AdminReportContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const c = value as Record<string, unknown>
  const text = (v: unknown, max: number) => typeof v === "string" ? v.slice(0, max) : ""
  return {
    path: text(c.path, FEEDBACK_PATH_MAX) || "/",
    userAgent: text(c.userAgent, FEEDBACK_USER_AGENT_MAX),
    viewport: typeof c.viewport === "string" ? c.viewport.slice(0, 20) : null,
    appVersion: text(c.appVersion, FEEDBACK_VERSION_MAX),
    hasScreenshot: typeof c.screenshotPath === "string" && c.screenshotPath.length > 0,
  }
}

/** Admin queue filter: every report, or only issues / feedback. */
export const ADMIN_REPORT_KIND_FILTERS = ["", "ISSUE", "FEEDBACK"] as const

/** Live admin queue: a content-free signal on a private topic only active platform admins may join. */
export const ADMIN_REPORTS_TOPIC = "platform-reports"
export const ADMIN_REPORTS_EVENT = "reports"
export const ADMIN_REPORTS_CHANGED_EVENT = "outclass:admin-reports-changed"
export const ADMIN_REPORTS_POLL_MS = 20_000
/** Off until the owner installs the Realtime receive policy (docs/feedback-reports.md); polling covers it meanwhile. */
export function adminReportsRealtimeEnabled(env: Record<string, string | undefined> = { NEXT_PUBLIC_ADMIN_REPORTS_REALTIME: process.env.NEXT_PUBLIC_ADMIN_REPORTS_REALTIME }) {
  return env.NEXT_PUBLIC_ADMIN_REPORTS_REALTIME === "1"
}
/** The broadcast body. Deliberately empty: receivers refetch through listAdminReports. */
export function adminReportsSignal() {
  return { messages: [{ topic: ADMIN_REPORTS_TOPIC, event: ADMIN_REPORTS_EVENT, payload: {}, private: true }] }
}
