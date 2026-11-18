"use server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ActionError, actionResult } from "@/lib/action-result";
import { CHECK_IN_PASS_LIFETIME_MS, CHECK_IN_PASS_MAX_LIVE, CHECK_IN_PASS_REFRESH_SECONDS, checkInPassPayload, parseCheckInPass, type DoorScanResult } from "@/lib/check-in-pass";
import { assertClubOperational, lockOperationalClub } from "@/lib/club-suspension";
import { isAlumniProfile } from "@/lib/graduation";
import { canCheckIn } from "@/lib/meetings";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { assertNotAlumni } from "@/utils/graduation";
import { prisma } from "@/utils/prisma";

// Door mode: the leader scans each student's personal pass (docs/qr-attendance.md, "Door mode").
// It records the same "EventAttendance" row as the student scanning the room's code
// (actions/meetings.ts checkInMeeting), under the same uniqueness rule and the same eligibility.

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** The signed-in student's own pass. Acts on the caller only; nothing in the input selects a user. */
async function issueCheckInPassCommand() {
  const { user, impersonation } = await requireAuth();
  // A support session never mints a credential that checks the member in somewhere.
  if (impersonation) throw new ActionError("A check-in pass isn’t available in a support session.", "FORBIDDEN");
  // Alumni cannot check in (lib/graduation.ts); the same refusal as checkInMeeting.
  await assertNotAlumni(prisma, user.id, "checkIn");
  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + CHECK_IN_PASS_LIFETIME_MS);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    await tx.meetingCheckInPass.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });
    // Keep only the newest live passes: a refresh overlaps the code still on screen.
    const live = await tx.meetingCheckInPass.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const extra = live.slice(CHECK_IN_PASS_MAX_LIVE - 1).map(row => row.id);
    if (extra.length) await tx.meetingCheckInPass.deleteMany({ where: { id: { in: extra } } });
    await tx.meetingCheckInPass.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt } });
  });
  return { payload: checkInPassPayload(token), expiresAt: expiresAt.toISOString(), refreshAfterSeconds: CHECK_IN_PASS_REFRESH_SECONDS };
}

const scanInput = z.object({ clubId: z.string().uuid(), meetingId: z.string().uuid(), payload: z.string().max(200) }).strict();

/** A leader records attendance from a scanned pass. Authorized by meetings.attendance on this club. */
async function scanCheckInPassCommand(input: unknown): Promise<DoorScanResult> {
  const { clubId, meetingId, payload } = scanInput.parse(input);
  const { user: scanner } = await requireClubPermission(clubId, ["meetings.attendance"]);
  const token = parseCheckInPass(payload);
  if (!token) throw new ActionError("That isn’t an OutClass check-in pass.", "NOT_A_PASS");
  return prisma.$transaction(async tx => {
    // Same lock order as issueMeetingCheckIn: the club, then the meeting row.
    await lockOperationalClub(tx, clubId);
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${meetingId} FOR UPDATE`;
    const meeting = await tx.meeting.findFirst({ where: { id: meetingId, clubId }, include: { publication: true } });
    if (!meeting) throw new ActionError("Meeting unavailable. Reload the meetings list.", "NOT_FOUND");
    await assertClubOperational(tx, meeting.clubId);
    const now = new Date();
    // The same attendance window as the room's code (issueMeetingCheckIn).
    if (now.getTime() < meeting.date.getTime() - 3600000 || now.getTime() > (meeting.endDate || meeting.date).getTime() + 6 * 3600000)
      throw new ActionError("Attendance opens one hour before the meeting and closes six hours after its end (or start if no end is set).", "CLOSED");
    // The scanner's own authority is re-read inside the transaction, as the room's code re-reads its issuer's.
    const expired = () => new ActionError("This pass has expired. Ask them to open their pass again.", "PASS_EXPIRED");
    const pass = await tx.meetingCheckInPass.findUnique({ where: { tokenHash: hash(token) } });
    if (!pass) throw expired();
    // Lock order is User, then pass, as in issueCheckInPass (which trims a user's passes under the same lock).
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${pass.userId} FOR SHARE`;
    // Single use: the delete is the claim. Two scanners at different meetings lock different rows above,
    // so only the one whose delete removes the row goes on; the pass is spent whatever the outcome.
    const spent = await tx.meetingCheckInPass.deleteMany({ where: { id: pass.id, expiresAt: { gt: now } } });
    if (spent.count !== 1) {
      await tx.meetingCheckInPass.deleteMany({ where: { id: pass.id } });
      throw expired();
    }
    const student = await tx.user.findUnique({
      where: { id: pass.userId },
      select: {
        id: true, disabledAt: true,
        studentProfile: { select: { firstName: true, lastName: true, graduatedAt: true } },
        memberships: { where: { clubId } },
        // As in meetingAttendance: no name for an applicant currently in anonymous review.
        applications: { where: { clubId, status: { not: "DRAFTING" }, round: { anonymousReview: true } }, select: { id: true }, take: 1 },
      },
    });
    // Disabled, graduated or not allowed at this meeting: one answer, naming no one.
    if (!student || student.disabledAt || isAlumniProfile(student.studentProfile, now) || !canCheckIn(meeting, student.memberships[0] ?? null)) return { status: "not-eligible" };
    const name = student.applications.length || !student.studentProfile ? null : `${student.studentProfile.firstName} ${student.studentProfile.lastName}`.trim() || null;
    const where = { eventId_studentId: { eventId: meetingId, studentId: student.id } };
    const existing = await tx.eventAttendance.findUnique({ where });
    if (existing) return { status: "already-checked-in", checkedInAt: existing.checkedInAt.toISOString(), name };
    const attendance = await tx.eventAttendance.create({ data: { eventId: meetingId, studentId: student.id } });
    // The row itself does not say who recorded it; the audit log does.
    await tx.auditLog.create({ data: { actorId: scanner.id, clubId, targetId: meetingId, action: "meeting.attendance.door_scan", details: { studentId: student.id } } });
    return { status: "checked-in", checkedInAt: attendance.checkedInAt.toISOString(), name };
    // A door line on a busy network: room for the ten short statements above, never an open-ended wait.
  }, { maxWait: 5000, timeout: 10000 });
}

export async function issueCheckInPass() {
  return actionResult(() => issueCheckInPassCommand(), "issueCheckInPass");
}
export async function scanCheckInPass(...args: Parameters<typeof scanCheckInPassCommand>) {
  return actionResult(() => scanCheckInPassCommand(...args), "scanCheckInPass");
}
