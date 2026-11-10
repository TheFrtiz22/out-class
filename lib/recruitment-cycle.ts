import type { AppTransactionClient } from "@/utils/prisma";

type CycleClient = Pick<AppTransactionClient, "recruitmentCycle" | "application">;

/**
 * A student has at most one application per club that is not REJECTED
 * (enforced by the partial unique index Application_one_open_per_student_club).
 * Rejected applications keep their reviews, interviews, votes and letters; a
 * re-application is a new row so none of that history is reused.
 */
export const openApplicationWhere = { status: { not: "REJECTED" as const } };

/** Newest first; drafts (no submittedAt) before submitted applications. */
export const applicationRecency = [{ submittedAt: { sort: "desc" as const, nulls: "first" as const } }, { id: "asc" as const }];

/** The club's single non-archived cycle, or null when there are none or several. */
export async function activeRecruitmentCycle(tx: CycleClient, clubId: string) {
  const cycles = await tx.recruitmentCycle.findMany({
    where: { clubId, archivedAt: null },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  return cycles.length === 1 ? cycles[0] : null;
}

export function currentApplication(tx: CycleClient, studentId: string, clubId: string) {
  return tx.application.findFirst({ where: { studentId, clubId, ...openApplicationWhere }, orderBy: applicationRecency });
}

/**
 * Null when the student may start a new application for the club; otherwise
 * the reason they cannot yet. After a rejection, a student may apply again
 * once the club has a different active recruitment cycle. A legacy rejected
 * application without a cycle counts as part of the active cycle when it was
 * submitted after that cycle was created.
 */
export async function reapplicationUnavailable(tx: CycleClient, studentId: string, clubId: string, active?: { id: string; createdAt: Date } | null): Promise<string | null> {
  const rejected = await tx.application.findFirst({ where: { studentId, clubId, status: "REJECTED" }, select: { id: true } });
  if (!rejected) return null;
  const cycle = active === undefined ? await activeRecruitmentCycle(tx, clubId) : active;
  if (!cycle) return "You can apply to this club again when it opens its next recruitment cycle.";
  const sameCycle = await tx.application.findFirst({
    where: {
      studentId, clubId, status: "REJECTED",
      OR: [{ recruitmentCycleId: cycle.id }, { recruitmentCycleId: null, submittedAt: { gte: cycle.createdAt } }],
    },
    select: { id: true },
  });
  return sameCycle ? "You can apply to this club again in its next recruitment cycle." : null;
}
