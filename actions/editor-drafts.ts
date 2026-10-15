"use server"
import { Prisma } from "@prisma/client"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { editorScopeSchema, editorSaveSchema, editorDraftKey, draftPermissions, type EditorScope } from "@/lib/editor-drafts"

async function authorize(tx: AppTransactionClient, scope: ReturnType<typeof editorScopeSchema.parse>, userId: string) {
  if (scope.kind === "task-submission") {
    const member = scope.clubId ? await authorizeClubTransaction(tx, scope.clubId, userId, []) : null
    const assignment = member && await tx.taskAssignment.findFirst({ where: { id: scope.resourceId, memberId: member.id, task: { clubId: scope.clubId, status: { not: "DRAFT" } } }, select: { id: true } })
    if (!assignment) throw Error("Task assignment unavailable.")
  } else if (scope.kind === "profile") {
    if (scope.clubId) throw Error("Personal drafts cannot belong to a club.")
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR SHARE`
    const user = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } })
    if (!user || user.disabledAt) throw Error("Account unavailable.")
  } else {
    if (!scope.clubId) throw Error("Club required.")
    await authorizeClubTransaction(tx, scope.clubId, userId, [draftPermissions[scope.kind]])
  }
}
export async function getEditorDraft(input: EditorScope) {
  const scope = editorScopeSchema.parse(input), { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorize(tx, scope, user.id)
    return tx.editorDraft.findUnique({ where: { userId_key: { userId: user.id, key: editorDraftKey(scope) } } })
  })
}
/** Draft storage has no path to publishing, scheduling, assignments, or submissions. */
export async function saveEditorDraft(input: unknown) {
  const data = editorSaveSchema.parse(input), { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorize(tx, data.scope, user.id)
    // Serialize first creation as well as updates, including personal drafts.
    const key = editorDraftKey(data.scope)
    // PostgreSQL returns void; Prisma cannot deserialize that raw result type.
    // Cast only the result, retaining the transaction-scoped serialization lock.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id + ":" + key}, 0))::text`
    const where = { userId_key: { userId: user.id, key } }
    const current = await tx.editorDraft.findUnique({ where })
    // Recover a lost acknowledgement without overwriting a later revision.
    if (current?.mutationId === data.mutationId) return { revision: current.revision }
    if ((current?.revision ?? 0) !== data.revision) return { error: "conflict" as const, message: "This draft changed in another tab. Your text is retained. Reopen the editor to compare drafts." }
    const fields = { content: data.content === null ? Prisma.DbNull : data.content as Prisma.InputJsonValue, base: data.base, mutationId: data.mutationId, revision: data.revision + 1 }
    if (current) await tx.editorDraft.update({ where, data: fields })
    else await tx.editorDraft.create({ data: { userId: user.id, key, ...fields } })
    return { revision: data.revision + 1 }
  })
}
