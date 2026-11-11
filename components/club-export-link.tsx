"use client"
import { Download } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useDemoMode } from "@/contexts/demo-context"
import { canExport, clubExportHref, type ClubExportKind } from "@/lib/club-exports-access"
import type { ClubAccess } from "@/lib/permissions"

/** A plain download link: the server re-checks access and writes the audit
 * record. Hidden in demo mode and for members without the export permission.
 * `filter` narrows to one round (applicants) or one meeting/event (attendance, RSVPs). */
export function ClubExportLink({ clubId, kind, membership, label, filter }: { clubId: string; kind: ClubExportKind; membership: ClubAccess | null | undefined; label: string; filter?: string | null }) {
  const demo = useDemoMode()
  if (demo.isDemoEnabled || !canExport(membership, kind)) return null
  return <Button asChild variant="ghost" size="sm">
    <a href={clubExportHref(clubId, kind, filter)} download><Download aria-hidden="true" className="size-4" />{label}</a>
  </Button>
}
