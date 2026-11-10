import { TriangleAlert } from "@/components/icons"
import { CampusNotice } from "@/components/campus-notice"
import "./site-notices.css"
import type { SiteNotices as SiteNoticeValues } from "@/lib/site-settings"

/**
 * Non-dismissible maintenance notice. Plain text only: React escapes it, nothing is parsed as HTML.
 * role="status" (polite), not "alert": the strip is part of every page, and an assertive region
 * would interrupt on each full load. It is labelled, so it is still reachable as a region.
 */
export function MaintenanceNotice({ text }: { text: string }) {
  if (!text) return null
  return (
    <aside role="status" aria-label="Maintenance notice" data-site-notice="maintenance" className="border-b border-border bg-warning-subtle text-foreground">
      <div className="mx-auto flex max-w-[var(--oc-content-width)] items-start gap-3 px-4 py-2 sm:px-6">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm font-medium">{text}</p>
      </div>
    </aside>
  )
}

/** Site-wide notices from Admin settings, shown above public and product pages. Empty notices render nothing. */
export function SiteNotices({ notices, offsetForSupportBanner = false }: { notices: Pick<SiteNoticeValues, "campusNotice" | "maintenanceNotice">; offsetForSupportBanner?: boolean }) {
  if (!notices.campusNotice && !notices.maintenanceNotice) return null
  // With a stale view-as cookie the fixed "Expired or unavailable session" banner is still drawn; start below it.
  return (
    <div data-site-notices="" style={offsetForSupportBanner ? { paddingTop: "var(--support-banner-height, 120px)" } : undefined}>
      <MaintenanceNotice text={notices.maintenanceNotice} />
      {notices.campusNotice ? <CampusNotice text={notices.campusNotice} /> : null}
    </div>
  )
}
