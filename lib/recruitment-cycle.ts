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

/**
 * Starting the next cycle from the last one. Recruitment configuration
 * (application questions and form settings, rounds and their order, rubric and
 * screening rules, interview kits, voting rule defaults, decision-letter
 * templates) is club-scoped and shared by every cycle, so the next cycle keeps
 * it in place rather than duplicating rows. Applicant-side and dated records
 * stay with the previous cycle. Shared by the server action and the leader UI.
 */
export const nextCycleCarriesForward = [
  "Application questions and form settings",
  "Rounds and their order",
  "Rubrics, scoring and screening rules",
  "Interview kits",
  "Voting rule defaults",
  "Decision-letter templates",
] as const;

export const nextCycleLeavesBehind = [
  "Applicants, applications, evaluations and notes",
  "Interview records, bookings and published interview times",
  "Voting sessions, ballots and decisions",
  "Letters already sent and audit history",
  "An application deadline that has already passed (left unset)",
] as const;

/** Audit action that links a new cycle to the cycle it started from (no schema column). */
export const START_NEXT_CYCLE_ACTION = "recruitment.cycle.started_from_previous";

/** Applications whose decision is still open; archiving their cycle would stop voting and booking for them. */
export const undecidedApplicationStatuses = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"] as const;

type ArchiveClient = Pick<AppTransactionClient, "application" | "votingSession">;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Voting sessions an archive would freeze: not ended, or ended but not yet finalized or published. */
export function liveVotingSessionWhere(clubId: string, cycleId: string) {
  return { clubId, cycleId, OR: [{ state: { in: ["DRAFT", "OPEN", "PAUSED"] } }, { state: "COMPLETED", finalizedAt: null, publishedAt: null }] };
}

/** Null when archiving the cycle cannot freeze a vote; otherwise why not. */
export async function cycleVotingBlocker(tx: ArchiveClient, clubId: string, cycle: { id: string; name: string }) {
  const sessions = await tx.votingSession.count({ where: liveVotingSessionWhere(clubId, cycle.id) });
  return sessions ? `${cycle.name} has ${plural(sessions, "voting session")} in progress or awaiting finalization. End and finalize voting before archiving this cycle.` : null;
}

/** Null when every application in the cycle has a final decision; waitlisted applications cannot be voted on once it is archived. */
export async function cycleDecisionBlocker(tx: ArchiveClient, clubId: string, cycle: { id: string; name: string }) {
  const undecided = await tx.application.count({ where: { clubId, recruitmentCycleId: cycle.id, status: { in: [...undecidedApplicationStatuses] } } });
  const waitlisted = await tx.application.count({ where: { clubId, recruitmentCycleId: cycle.id, status: "WAITLISTED" } });
  if (!undecided && !waitlisted) return null;
  const parts = [undecided ? plural(undecided, "undecided application") : "", waitlisted ? plural(waitlisted, "waitlisted application") : ""].filter(Boolean).join(" and ");
  return `${cycle.name} still has ${parts}. Record final decisions before starting the next cycle.`;
}

/** A passed deadline is not carried into the next cycle: it is left unset for the leader to choose. */
export function nextCycleDeadline(deadline: Date | null, now: Date): Date | null {
  return deadline && deadline.getTime() > now.getTime() ? deadline : null;
}
