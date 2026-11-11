import { z } from "zod"

/** Platform settings live in one PlatformContent JSON row; no column or migration per field. */
export const PLATFORM_SETTINGS_KEY = "platform:settings"
/** Cache tag for the site-wide notice reader; Admin saves revalidate it. */
export const SITE_SETTINGS_TAG = "platform-settings"
export const SITE_SETTINGS_REVALIDATE_SECONDS = 60
export const DEFAULT_MAINTENANCE_NOTICE = "OutClass is undergoing maintenance. Changes are paused for now."
export const MAINTENANCE_WRITE_MESSAGE = "OutClass is undergoing maintenance. Changes are paused until it finishes. Try again shortly."

/** Admin-editable platform settings. Maintenance mode is opt-in and defaults OFF. */
export const platformSettingsSchema = z.object({
  supportEmail: z.union([z.string().email().max(254), z.literal("")]).default(""),
  campusNotice: z.string().trim().max(500).default(""),
  maintenanceNotice: z.string().trim().max(500).default(""),
  maintenanceMode: z.boolean().default(false),
}).strict()
export type PlatformSettings = z.infer<typeof platformSettingsSchema>

export type SiteNotices = { campusNotice: string; maintenanceNotice: string; maintenanceMode: boolean }
export const EMPTY_SITE_NOTICES: SiteNotices = Object.freeze({ campusNotice: "", maintenanceNotice: "", maintenanceMode: false })

/** Only the public fields leave the server. A malformed row fails closed to "no notices, mode OFF". */
export function siteNoticesFrom(value: unknown): SiteNotices {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const text = (input: unknown) => typeof input === "string" ? input.trim().slice(0, 500) : ""
  return { campusNotice: text(source.campusNotice), maintenanceNotice: text(source.maintenanceNotice), maintenanceMode: source.maintenanceMode === true }
}
