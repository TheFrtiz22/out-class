import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { applicantExport, attendanceExport, rosterExport, rsvpExport } from "@/lib/club-exports"
import { clubExportFilter, clubExportKinds, clubExportPermissions } from "@/lib/club-exports-access"
import { csvFilename, toCsv } from "@/lib/csv"
import { normalizeProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { auditSupportAction } from "@/utils/support-audit"
import { clubHasFeature } from "@/utils/club-features"

const query = z.object({ clubId: z.string().uuid(), kind: z.enum(clubExportKinds), roundId: z.string().uuid().optional(), eventId: z.string().uuid().optional() }).strict()
  // A filter is accepted only for the kind it narrows (round → applicants, event → attendance/RSVPs).
  .refine(q => (["roundId", "eventId"] as const).every(key => q[key] === undefined || clubExportFilter[q.kind] === key))
// Thrown only after both capability checks pass, so outsiders never learn the switch state.
class ExportFeatureOff extends Error {}
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const input = query.safeParse({ clubId: params.get("clubId"), kind: params.get("kind"),
    roundId: params.get("roundId") ?? undefined, eventId: params.get("eventId") ?? undefined })
  if (!input.success) return new Response("Invalid export", { status: 400, headers: privateHeaders })
  const { clubId, kind, roundId, eventId } = input.data
  try {
    const { user } = await requireClubPermission(clubId, clubExportPermissions[kind], { allowSuspendedRead: true })
    const { table, clubName } = await prisma.$transaction(async tx => {
      // Re-check inside the snapshot so a revoked leader cannot export.
      const member = await authorizeClubTransaction(tx, clubId, user.id, clubExportPermissions[kind], { readOnly: true, allowSuspendedRead: true })
      // Pilot switch (default off), read on the server in the same snapshot; suspension does not affect it.
      if (!(await clubHasFeature(tx, clubId, "csvExport"))) throw new ExportFeatureOff()
      const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true, profileFieldVisibility: true } })
      // The club's profile field choice decides which profile columns exist at all.
      const profileFields = normalizeProfileFieldVisibility(club.profileFieldVisibility)
      // Every builder scopes by clubId itself; a round or event from another club yields no rows.
      const table = kind === "applicants" ? await applicantExport(tx, clubId, member, profileFields, roundId)
        : kind === "roster" ? await rosterExport(tx, clubId, profileFields)
        : kind === "rsvps" ? await rsvpExport(tx, clubId, eventId) : await attendanceExport(tx, clubId, eventId)
      await tx.auditLog.create({ data: { actorId: user.id, action: `club.export.${kind}`, targetId: clubId, clubId,
        details: { rows: table.rows.length, ...(roundId ? { roundId } : {}), ...(eventId ? { eventId } : {}) } } })
      return { table, clubName: club.name }
    }, { isolationLevel: "RepeatableRead", timeout: 20000 })
    // Under support view-as, also record the real administrator, as the résumé route does.
    await auditSupportAction(`platform.impersonation.club-export.${kind}`, clubId)
    return new Response(toCsv(table.header, table.rows), { headers: { ...privateHeaders,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${csvFilename(clubName, kind)}"` } })
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error
    if (error instanceof ExportFeatureOff) return new Response("CSV export is not enabled for this club.", { status: 403, headers: privateHeaders })
    return new Response("Export unavailable", { status: 403, headers: privateHeaders })
  }
}
