import { Prisma } from "@prisma/client"
import { z } from "zod"
import { pipelineSummarySelect } from "@/lib/pipeline-summary"
import type { AppTransactionClient } from "@/utils/prisma"

const { evaluations: _evaluations, interviewAssignments: _assignments, ...metadataSelect } = pipelineSummarySelect
export const pipelinePageMetadataSelect = metadataSelect
type Metadata = Prisma.ApplicationGetPayload<{ select: typeof pipelinePageMetadataSelect }>
type Profile = NonNullable<Metadata["student"]["studentProfile"]>
type Row = Pick<Metadata, "id" | "roundId" | "studentId" | "status"> & {
  anonymousReview: boolean; email: string; hasProfile: boolean
} & { [K in keyof Profile]: Profile[K] | null }

// Recognize the complete guarded predicate, never just a subset of it. Future
// predicates/relations fall back to Prisma with the original where object.
const scopeSchema = z.object({
  clubId: z.string().min(1), status: z.object({ not: z.literal("DRAFTING") }).strict(),
  id: z.string().min(1).optional(), roundId: z.string().min(1).optional(),
  round: z.object({ anonymousReview: z.literal(true) }).strict().optional(),
  student: z.object({ studentProfile: z.object({ gender: z.string().min(1) }).strict() }).strict().optional(),
}).strict()

export function pipelineMetadataQuery(where: Prisma.ApplicationWhereInput): Prisma.Sql | null {
  const parsed = scopeSchema.safeParse(where)
  if (!parsed.success) return null
  const scope = parsed.data
  const predicates = [Prisma.sql`a."clubId" = ${scope.clubId}`, Prisma.sql`a."status" <> 'DRAFTING'`]
  if (scope.id !== undefined) predicates.push(Prisma.sql`a."id" = ${scope.id}`)
  if (scope.roundId !== undefined) predicates.push(Prisma.sql`a."roundId" = ${scope.roundId}`)
  if (scope.round) predicates.push(Prisma.sql`r."anonymousReview" = TRUE`)
  if (scope.student) predicates.push(Prisma.sql`p."gender" = ${scope.student.studentProfile.gender}`)
  // Static identifiers and allowlisted columns only; every scope value is a
  // bound parameter. No free-text query, collation or privacy logic in SQL.
  return Prisma.sql`
    SELECT a."id", a."roundId", a."studentId", a."status"::text AS "status",
      r."anonymousReview", u."email", p."userId" IS NOT NULL AS "hasProfile",
      p."firstName", p."lastName", p."major", p."gradYear", p."transferStudent",
      p."gpa", p."satScore", p."actScore"
    FROM "Application" a
    JOIN "PipelineRound" r ON r."id" = a."roundId"
    JOIN "User" u ON u."id" = a."studentId"
    LEFT JOIN "StudentProfile" p ON p."userId" = u."id"
    WHERE ${Prisma.join(predicates, " AND ")}`
}

/** Called inside the existing freshly guarded Repeatable Read transaction. */
export async function readPipelineMetadata(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput): Promise<Metadata[]> {
  const query = pipelineMetadataQuery(where)
  if (!query) return tx.application.findMany({ where, select: pipelinePageMetadataSelect })
  const rows = await tx.$queryRaw<Row[]>(query)
  return rows.map(row => ({
    id: row.id, roundId: row.roundId, studentId: row.studentId, status: row.status,
    round: { anonymousReview: row.anonymousReview },
    student: { email: row.email, studentProfile: row.hasProfile ? {
      firstName: row.firstName!, lastName: row.lastName!, major: row.major!,
      gradYear: row.gradYear!, transferStudent: row.transferStudent!,
      gpa: row.gpa, satScore: row.satScore, actScore: row.actScore,
    } : null },
  }))
}
