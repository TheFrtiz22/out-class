"use client"
import { Download } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { isFeatureEnabled } from "@/lib/club-features"
import { canExport, clubExportHref, type ClubExportKind } from "@/lib/club-exports-access"
import type { ClubAccess } from "@/lib/permissions"

export const csvExportOffNotice = "CSV export isn't turned on for this club yet."

/** A plain download link: the server re-checks access and the club's `csvExport`
 * switch, and writes the audit record. Hidden in demo mode and for members without
 * the export permission. While the club's switch is off, leaders see a short note
 * instead (`showNotice={false}` for a second link beside the first).
 * `filter` narrows to one round (applicants) or one meeting/event (attendance, RSVPs). */
export function ClubExportLink({ clubId, kind, membership, label, filter, showNotice = true }: { clubId: string; kind: ClubExportKind; membership: ClubAccess | null | undefined; label: string; filter?: string | null; showNotice?: boolean }) {
  const demo = useDemoMode()
  const { user } = useAuth()
  if (demo.isDemoEnabled || !user || !canExport(membership, kind)) return null
  // Display only; the switch is read from the signed-in account's own membership.
  const club = user.memberships.find(m => m.clubId === clubId)?.club
  if (!isFeatureEnabled(club?.features, "csvExport"))
    return showNotice ? <p className="text-xs text-muted-foreground">{csvExportOffNotice}</p> : null
  return <Button asChild variant="ghost" size="sm">
    <a href={clubExportHref(clubId, kind, filter)} download><Download aria-hidden="true" className="size-4" />{label}</a>
  </Button>
}
