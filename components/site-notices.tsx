import { TriangleAlert } from "@/components/icons"
import { CampusNotice } from "@/components/campus-notice"
import { SiteNoticeOffset } from "@/components/site-notice-offset"
import type { SiteNotices as SiteNoticeValues } from "@/lib/site-settings"

/** Non-dismissible maintenance notice. Plain text only: React escapes it, nothing is parsed as HTML. */
export function MaintenanceNotice({ text }: { text: string }) {
  if (!text) return null
  return (
    <aside role="alert" aria-label="Maintenance notice" data-site-notice="maintenance" className="border-b border-border bg-warning-subtle text-foreground">
      <div className="mx-auto flex max-w-[var(--oc-content-width)] items-start gap-3 px-4 py-2 sm:px-6">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm font-medium">{text}</p>
      </div>
    </aside>
  )
}

/** Site-wide notices from Admin settings, shown above public and product pages. Empty notices render nothing. */
export function SiteNotices({ notices }: { notices: Pick<SiteNoticeValues, "campusNotice" | "maintenanceNotice"> }) {
  if (!notices.campusNotice && !notices.maintenanceNotice) return null
  return (
    <div data-site-notices="">
      <MaintenanceNotice text={notices.maintenanceNotice} />
      {notices.campusNotice ? <CampusNotice text={notices.campusNotice} /> : null}
      <SiteNoticeOffset />
    </div>
  )
}
