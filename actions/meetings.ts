"use server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import {
  meetingInputSchema,
  meetingFields,
  canReadMeeting,
  TOKEN_LIFETIME_MS,
  type CheckInResult,
} from "@/lib/meetings";
import { revalidatePath } from "next/cache";
export async function listMeetings(clubId?: string) {
  const { user } = await requireAuth();
  if (clubId) z.string().uuid().parse(clubId);
  return prisma.meeting.findMany({
    where: {
      ...(clubId ? { clubId } : {}),
      OR: [
        { audience: "RECRUITMENT", isPublic: true },
        { club: { members: { some: { userId: user.id } } } },
      ],
    },
    select: meetingFields,
    orderBy: [{ date: "desc" }, { id: "asc" }],
  });
}
export async function getMeeting(meetingId: string) {
  z.string().uuid().parse(meetingId);
  const { user } = await requireAuth();
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      OR: [
        { audience: "RECRUITMENT", isPublic: true },
        { club: { members: { some: { userId: user.id } } } },
      ],
    },
    select: meetingFields,
  });
  if (!meeting) throw new Error("Meeting unavailable or access denied.");
  return meeting;
}
export async function saveMeeting(input: unknown) {
  const data = meetingInputSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, [
    "meetings.manage",
  ]);
  return prisma.$transaction(async (tx) => {
    const { id, revision, ...fields } = data;
    const values = { ...fields, isPublic: data.audience === "RECRUITMENT" };
    let meeting;
    if (id) {
      const result = await tx.meeting.updateMany({
        where: { id, clubId: data.clubId, revision },
        data: { ...values, revision: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new Error(
          "Meeting changed or is unavailable. Reload before editing.",
        );
      await tx.meetingCheckInToken.deleteMany({ where: { meetingId: id } });
      meeting = await tx.meeting.findUnique({
        where: { id },
        select: meetingFields,
      });
    } else
      meeting = await tx.meeting.create({
        data: values,
        select: meetingFields,
      });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "meeting.save",
        targetId: meeting!.id,
        clubId: data.clubId,
      },
    });
    revalidatePath("/");
    revalidatePath("/meetings");
    return meeting!;
  });
}
export async function issueMeetingCheckIn(clubId: string, meetingId: string) {
  const { user } = await requireClubPermission(clubId, ["meetings.attendance"]);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${meetingId} FOR UPDATE`;
    const meeting = await tx.meeting.findFirst({
      where: { id: meetingId, clubId },
    });
    if (!meeting) throw new Error("Meeting unavailable.");
    const now = new Date();
    if (
      now.getTime() < meeting.date.getTime() - 3600000 ||
      now.getTime() > (meeting.endDate || meeting.date).getTime() + 6 * 3600000
    )
      throw new Error(
        "Attendance opens one hour before the meeting and closes six hours after its end (or start if no end is set).",
      );
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);
    await tx.meetingCheckInToken.deleteMany({
      where: { meetingId, expiresAt: { lte: now } },
    });
    await tx.meetingCheckInToken.create({
      data: {
        meetingId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt,
        issuedBy: user.id,
      },
    });
    return { token, expiresAt: expiresAt.toISOString() };
  });
}
export async function closeMeetingCheckIn(clubId: string, meetingId: string) {
  await requireClubPermission(clubId, ["meetings.attendance"]);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${meetingId} FOR UPDATE`;
    if (!(await tx.meeting.findFirst({ where: { id: meetingId, clubId } })))
      throw new Error("Meeting unavailable.");
    await tx.meetingCheckInToken.deleteMany({ where: { meetingId } });
    return { success: true };
  });
}
export async function checkInMeeting(
  meetingId: string,
  token: string,
): Promise<CheckInResult> {
  z.string().uuid().parse(meetingId);
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error(
      "Invalid check-in code. Scan the current QR code at the meeting.",
    );
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${meetingId} FOR UPDATE`;
    const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new Error("Meeting unavailable.");
    const membership = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: meeting.clubId } },
    });
    if (!canReadMeeting(meeting, membership))
      throw new Error("This meeting is available to club members only.");
    const access = await tx.meetingCheckInToken.findFirst({
      where: {
        meetingId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: { gt: new Date() },
      },
    });
    if (!access)
      throw new Error(
        "This code has expired or was closed. Scan the current QR code at the meeting.",
      );
    const issuer = await tx.clubMember.findUnique({
      where: {
        userId_clubId: { userId: access.issuedBy, clubId: meeting.clubId },
      },
    });
    const issuerUser = await tx.user.findUnique({
      where: { id: access.issuedBy },
      select: { disabledAt: true },
    });
    if (
      !issuerUser ||
      issuerUser.disabledAt ||
      !hasPermission(issuer, "meetings.attendance")
    )
      throw new Error(
        "This check-in session is no longer available. Ask a meeting manager to reopen it.",
      );
    const where = {
      eventId_studentId: { eventId: meetingId, studentId: user.id },
    };
    const existing = await tx.eventAttendance.findUnique({ where });
    if (existing)
      return {
        status: "already-checked-in",
        checkedInAt: existing.checkedInAt.toISOString(),
      };
    const attendance = await tx.eventAttendance.create({
      data: { eventId: meetingId, studentId: user.id },
    });
    revalidatePath("/");
    return {
      status: "checked-in",
      checkedInAt: attendance.checkedInAt.toISOString(),
    };
  });
}
export async function meetingAttendance(clubId: string, meetingId: string) {
  await requireClubPermission(clubId, ["meetings.attendance"]);
  if (!(await prisma.meeting.findFirst({ where: { id: meetingId, clubId } })))
    throw new Error("Meeting unavailable.");
  // Do not disclose names for applicants currently in anonymous review.
  const rows = await prisma.eventAttendance.findMany({
    where: { eventId: meetingId, event: { clubId } },
    select: {
      id: true,
      checkedInAt: true,
      student: {
        select: {
          id: true,
          email: true,
          studentProfile: { select: { firstName: true, lastName: true } },
          applications: {
            where: {
              clubId,
              status: { not: "DRAFTING" },
              round: { anonymousReview: true },
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { checkedInAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    checkedInAt: r.checkedInAt.toISOString(),
    name: r.student.applications.length
      ? "Anonymous applicant"
      : r.student.studentProfile
        ? `${r.student.studentProfile.firstName} ${r.student.studentProfile.lastName}`
        : r.student.email,
    email: r.student.applications.length ? null : r.student.email,
  }));
}
export async function recruitmentAttendanceSummary(
  clubId: string,
  applicationId: string,
) {
  const { membership } = await requireClubPermission(clubId, []);
  if (
    !hasPermission(membership, "applications.review") &&
    !hasPermission(membership, "applicants.identify")
  )
    throw new Error("Applicant review access required.");
  const application = await prisma.application.findFirst({
    where: { id: applicationId, clubId, status: { not: "DRAFTING" } },
    select: { studentId: true, round: { select: { anonymousReview: true } } },
  });
  if (
    !application ||
    (!application.round.anonymousReview &&
      !hasPermission(membership, "applicants.identify"))
  )
    throw new Error("Applicant unavailable.");
  const where = {
    clubId,
    audience: "RECRUITMENT",
    isPublic: true,
    date: { lte: new Date() },
  };
  const [held, attended] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.eventAttendance.count({
      where: { studentId: application.studentId, event: where },
    }),
  ]);
  return { held, attended };
}
