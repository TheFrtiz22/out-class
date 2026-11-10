import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/utils/prisma"
import { EMPTY_SITE_NOTICES, MAINTENANCE_WRITE_MESSAGE, PLATFORM_SETTINGS_KEY, SITE_SETTINGS_REVALIDATE_SECONDS, SITE_SETTINGS_TAG, siteNoticesFrom, type SiteNotices } from "@/lib/site-settings"

// Shared across requests for at most 60 s (or until an Admin save revalidates the tag),
// so page views do not each query PlatformContent. Only the public notice fields are cached.
const readStoredNotices = unstable_cache(async (): Promise<SiteNotices> => {
  const row = await prisma.platformContent.findUnique({ where: { key: PLATFORM_SETTINGS_KEY }, select: { value: true } })
  return siteNoticesFrom(row?.value)
}, ["platform-settings:notices"], { revalidate: SITE_SETTINGS_REVALIDATE_SECONDS, tags: [SITE_SETTINGS_TAG] })

export const SITE_NOTICES_TIMEOUT_MS = 1_500
export const SITE_NOTICES_FAILURE_BACKOFF_MS = 10_000
// Process-wide outage backoff: platform state only, never per-user data.
let unavailableUntil = 0

function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`settings read exceeded ${ms} ms`)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Site-wide Campus/Maintenance notices and maintenance mode, deduplicated per request.
 * Fails open: a slow (> 1.5 s) or failing read shows no notices with maintenance mode OFF,
 * and further reads skip the database for 10 s so an outage is not retried on every render.
 */
export const getSiteNotices = cache(async (): Promise<SiteNotices> => {
  if (Date.now() < unavailableUntil) return EMPTY_SITE_NOTICES
  try {
    return await withTimeout(readStoredNotices(), SITE_NOTICES_TIMEOUT_MS)
  } catch (error) {
    unavailableUntil = Date.now() + SITE_NOTICES_FAILURE_BACKOFF_MS
    console.error("site notices unavailable", error instanceof Error ? error.message : error)
    return EMPTY_SITE_NOTICES
  }
})

/**
 * Platform administrators stay fully usable during maintenance. Same allowlist + active grant
 * as `requirePlatformAdminEligibility`, without its auth call (callers already resolved the user),
 * so it can run inside `requireAuth` without recursion. Only queried while maintenance is ON.
 */
export const isMaintenanceExempt = cache(async (userId: string): Promise<boolean> => {
  const allowed = (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(id => id.trim()).filter(Boolean)
  if (!allowed.includes(userId)) return false
  const grant = await prisma.platformAdmin.findUnique({ where: { userId }, select: { active: true } })
  return !!grant?.active
})

export class MaintenanceModeError extends Error {
  constructor() { super(MAINTENANCE_WRITE_MESSAGE); this.name = "MaintenanceModeError" }
}

/** Refuse the operation for non-admins while maintenance mode is ON. Cheap when OFF (cached read). */
export async function assertSiteWritable(userId: string) {
  const { maintenanceMode } = await getSiteNotices()
  if (maintenanceMode && !(await isMaintenanceExempt(userId))) throw new MaintenanceModeError()
}
