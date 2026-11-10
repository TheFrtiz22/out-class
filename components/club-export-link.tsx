"use client"
import { Download } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useDemoMode } from "@/contexts/demo-context"
import { canExport, type ClubExportKind } from "@/lib/club-exports-access"
import type { ClubAccess } from "@/lib/permissions"

/** A plain download link: the server re-checks access and writes the audit
 * record. Hidden in demo mode and for members without the export permission. */
export function ClubExportLink({ clubId, kind, membership, label }: { clubId: string; kind: ClubExportKind; membership: ClubAccess | null | undefined; label: string }) {
  const demo = useDemoMode()
  if (demo.isDemoEnabled || !canExport(membership, kind)) return null
  return <Button asChild variant="ghost" size="sm">
    <a href={`/api/club-exports?clubId=${encodeURIComponent(clubId)}&kind=${kind}`} download><Download aria-hidden="true" className="size-4" />{label}</a>
  </Button>
}
