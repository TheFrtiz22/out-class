"use client"
import { Download } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { isFeatureEnabled } from "@/lib/club-features"
import { canExport, clubExportHref, type ClubExportKind } from "@/lib/club-exports-access"
import type { ClubAccess } from "@/lib/permissions"

/** A plain download link: the server re-checks access and the club's `csvExport`
 * switch, and writes the audit record. Hidden in demo mode, for members without
 * the export permission, and while the club's switch is off.
 * `filter` narrows to one round (applicants) or one meeting/event (attendance, RSVPs). */
export function ClubExportLink({ clubId, kind, membership, label, filter }: { clubId: string; kind: ClubExportKind; membership: ClubAccess | null | undefined; label: string; filter?: string | null }) {
  const demo = useDemoMode()
  const { user } = useAuth()
  if (demo.isDemoEnabled || !user || !canExport(membership, kind)) return null
  // Display only; the switch is read from the signed-in account's own membership.
  const club = user.memberships.find(m => m.clubId === clubId)?.club
  if (!isFeatureEnabled(club?.features, "csvExport")) return null
  return <Button asChild variant="ghost" size="sm">
    <a href={clubExportHref(clubId, kind, filter)} download><Download aria-hidden="true" className="size-4" />{label}</a>
  </Button>
}
