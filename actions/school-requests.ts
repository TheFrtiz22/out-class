"use server"

import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { reviewSchoolRequestSchema, schoolRequestStatuses } from "@/lib/school-requests"

export async function listSchoolRequests(input: unknown) {
  const actor = await requirePlatformAdmin()
  const filter = z.object({ status: z.union([z.enum(schoolRequestStatuses), z.literal("")]).default(""), page: z.number().int().min(0).max(10000).default(0) }).strict().parse(input)
  const rows = await prisma.schoolRequest.findMany({ where: filter.status ? { status: filter.status } : {}, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 51, skip: filter.page * 50 })
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.school-requests.read", targetId: "school-requests", details: { ...filter, result: "success" } } })
  return { rows: rows.slice(0, 50), hasMore: rows.length > 50 }
}

export async function reviewSchoolRequest(input: unknown) {
  const actor = await requirePlatformAdmin()
  const data = reviewSchoolRequestSchema.parse(input)
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "SchoolRequest" WHERE id=${data.id} FOR UPDATE`
    const row = await tx.schoolRequest.findUnique({ where: { id: data.id } })
    if (!row || row.revision !== data.revision) throw new Error("Request changed. Reload before reviewing.")
    await tx.schoolRequest.update({ where: { id: data.id }, data: { status: data.status, reviewNote: data.note, reviewedBy: actor.id, reviewedAt: new Date(), revision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.school-request.review", targetId: data.id, reason: data.note, details: { from: row.status, to: data.status, result: "success" } } })
    return { success: true }
  })
}
