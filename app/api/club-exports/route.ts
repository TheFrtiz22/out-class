import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { applicantExport, attendanceExport, rosterExport } from "@/lib/club-exports"
import { clubExportKinds, clubExportPermissions } from "@/lib/club-exports-access"
import { csvFilename, toCsv } from "@/lib/csv"

const query = z.object({ clubId: z.string().uuid(), kind: z.enum(clubExportKinds) }).strict()
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const input = query.safeParse({ clubId: params.get("clubId"), kind: params.get("kind") })
  if (!input.success) return new Response("Invalid export", { status: 400, headers: privateHeaders })
  const { clubId, kind } = input.data
  try {
    const { user } = await requireClubPermission(clubId, clubExportPermissions[kind], { allowSuspendedRead: true })
    const { table, clubName } = await prisma.$transaction(async tx => {
      // Re-check inside the snapshot so a revoked leader cannot export.
      const member = await authorizeClubTransaction(tx, clubId, user.id, clubExportPermissions[kind], { readOnly: true, allowSuspendedRead: true })
      const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } })
      const table = kind === "applicants" ? await applicantExport(tx, clubId, member)
        : kind === "roster" ? await rosterExport(tx, clubId) : await attendanceExport(tx, clubId)
      await tx.auditLog.create({ data: { actorId: user.id, action: `club.export.${kind}`, targetId: clubId, clubId, details: { rows: table.rows.length } } })
      return { table, clubName: club.name }
    }, { isolationLevel: "RepeatableRead", timeout: 20000 })
    return new Response(toCsv(table.header, table.rows), { headers: { ...privateHeaders,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${csvFilename(clubName, kind)}"` } })
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error
    return new Response("Export unavailable", { status: 403, headers: privateHeaders })
  }
}
