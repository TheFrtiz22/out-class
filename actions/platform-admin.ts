"use server";
import { z } from "zod";
import {
  platformResources,
  platformFiltersSchema,
  platformStatuses,
  type PlatformFilters,
  applicationStates,
} from "@/lib/platform-console";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { readDemoTemplate } from "@/lib/demo/validate";
import { clubPermissions } from "@/lib/permissions";

const resources = z.enum(platformResources);
export type PlatformResource = z.infer<typeof resources>;
export async function readPlatformResource(
  input: PlatformResource,
  page = 0,
  filters: PlatformFilters = {},
) {
  const actor = await requirePlatformAdmin(),
    resource = resources.parse(input),
    f = platformFiltersSchema.parse(filters);
  const skip = z.number().int().min(0).max(10000).parse(page) * 100;
  if (f.status && !platformStatuses[resource]?.includes(f.status))
    throw new Error("Choose a valid status for this resource.");
  if (
    f.permission &&
    !clubPermissions.includes(f.permission as (typeof clubPermissions)[number])
  )
    throw new Error("Unknown permission.");
  const text = { contains: f.query, mode: "insensitive" as const },
    club = f.clubId ? { clubId: f.clubId } : {},
    dates =
      f.from || f.to
        ? {
            ...(f.from ? { gte: new Date(f.from) } : {}),
            ...(f.to ? { lte: new Date(f.to) } : {}),
          }
        : undefined;
  const paging = { take: 100, skip };
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "platform.read",
      targetId: resource,
      details: { page, filters: f },
    },
  });
  switch (resource) {
    case "users":
      return prisma.user.findMany({
        ...paging,
        where: {
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { email: text },
                  { studentProfile: { firstName: text } },
                  { studentProfile: { lastName: text } },
                ],
              }
            : {}),
          ...(f.userId ? { id: f.userId } : {}),
          ...(f.status
            ? { disabledAt: f.status === "ACTIVE" ? null : { not: null } }
            : {}),
          ...(dates ? { createdAt: dates } : {}),
        },
        select: { id: true, email: true, disabledAt: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    case "clubs":
      return prisma.club.findMany({
        ...paging,
        where: {
          ...(f.clubId ? { id: f.clubId } : {}),
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { name: text },
                  { slug: text },
                  { category: text },
                ],
              }
            : {}),
          ...(f.status
            ? { claimedAt: f.status === "CLAIMED" ? { not: null } : null }
            : {}),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
    case "claims":
      return prisma.clubClaim.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.userId ? { userId: f.userId } : {}),
          ...(f.status ? { status: f.status } : {}),
          ...(dates ? { createdAt: dates } : {}),
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { explanation: text },
                  { club: { name: text } },
                  { user: { email: text } },
                ],
              }
            : {}),
        },
        include: {
          club: { select: { name: true } },
          user: { select: { email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    case "memberships":
      return prisma.clubMember.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.userId ? { userId: f.userId } : {}),
          ...(f.permission
            ? {
                OR: [{ isOwner: true }, { permissions: { has: f.permission } }],
              }
            : {}),
          ...(f.query
            ? {
                AND: [
                  {
                    OR: [
                      { id: text },
                      { club: { name: text } },
                      { user: { email: text } },
                    ],
                  },
                ],
              }
            : {}),
        },
        include: {
          club: { select: { name: true } },
          user: { select: { email: true } },
        },
        orderBy: { id: "asc" },
      });
    case "rounds":
      return prisma.pipelineRound.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.query
            ? { OR: [{ id: text }, { name: text }, { club: { name: text } }] }
            : {}),
        },
        orderBy: [{ clubId: "asc" }, { order: "asc" }, { id: "asc" }],
      });
    case "questions":
      return prisma.applicationQuestion.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.query ? { OR: [{ id: text }, { prompt: text }] } : {}),
        },
        orderBy: { id: "asc" },
      });
    case "interviews":
      return prisma.interviewSlot.findMany({
        ...paging,
        where: {
          ...club,
          ...(dates ? { startTime: dates } : {}),
          ...(f.query ? { OR: [{ id: text }, { location: text }] } : {}),
        },
        orderBy: [{ startTime: "desc" }, { id: "asc" }],
      });
    case "applications":
      return prisma.application.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.userId ? { studentId: f.userId } : {}),
          ...(f.status
            ? { status: z.enum(applicationStates).parse(f.status) }
            : {}),
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { club: { name: text } },
                  { student: { email: text } },
                ],
              }
            : {}),
        },
        include: {
          club: { select: { name: true } },
          student: { select: { email: true } },
          round: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      });
    case "meetings":
      return prisma.meeting.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.status ? { audience: f.status } : {}),
          ...(dates ? { date: dates } : {}),
          ...(f.query
            ? { OR: [{ id: text }, { title: text }, { location: text }] }
            : {}),
        },
        orderBy: [{ date: "desc" }, { id: "asc" }],
      });
    case "tasks":
      return prisma.clubTask.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.status ? { status: f.status } : {}),
          ...(dates ? { createdAt: dates } : {}),
          ...(f.query
            ? { OR: [{ id: text }, { title: text }, { description: text }] }
            : {}),
        },
        include: { _count: { select: { assignments: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    case "submissions":
      return prisma.taskAssignment.findMany({
        ...paging,
        where: {
          ...(f.clubId ? { task: { clubId: f.clubId } } : {}),
          ...(f.userId ? { userId: f.userId } : {}),
          ...(f.status === "ASSIGNED"
            ? { submittedAt: null, reviewedAt: null }
            : f.status === "SUBMITTED"
              ? { submittedAt: { not: null }, reviewedAt: null }
              : f.status === "REVIEWED"
                ? { reviewedAt: { not: null } }
                : {}),
          ...(dates ? { assignedAt: dates } : {}),
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { task: { title: text } },
                  { recipient: { email: text } },
                ],
              }
            : {}),
        },
        include: {
          task: { select: { title: true, clubId: true } },
          recipient: { select: { email: true } },
          files: {
            where: { submitted: true },
            select: { id: true, name: true, size: true },
          },
        },
        orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
      });
    case "content":
      return prisma.platformContent.findMany({
        ...paging,
        where: {
          ...(f.query ? { key: text } : {}),
          ...(dates ? { updatedAt: dates } : {}),
        },
        orderBy: { key: "asc" },
      });
    case "view-sessions":
      return prisma.platformViewSession.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.userId
            ? { OR: [{ actorId: f.userId }, { targetUserId: f.userId }] }
            : {}),
          ...(f.query
            ? {
                AND: [
                  {
                    OR: [
                      { actorId: text },
                      { targetUserId: text },
                      { reason: text },
                    ],
                  },
                ],
              }
            : {}),
          ...(dates ? { createdAt: dates } : {}),
          ...(f.status === "ACTIVE"
            ? { endedAt: null, expiresAt: { gt: new Date() } }
            : f.status === "ENDED"
              ? { endedAt: { not: null } }
              : f.status === "EXPIRED"
                ? { endedAt: null, expiresAt: { lte: new Date() } }
                : {}),
        },
        select: {
          id: true,
          actorId: true,
          targetUserId: true,
          clubId: true,
          reason: true,
          createdAt: true,
          expiresAt: true,
          endedAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    case "audit":
      return prisma.auditLog.findMany({
        ...paging,
        where: {
          ...club,
          ...(f.userId ? { actorId: f.userId } : {}),
          ...(f.action
            ? { action: { contains: f.action, mode: "insensitive" } }
            : {}),
          ...(dates ? { createdAt: dates } : {}),
          ...(f.query
            ? {
                OR: [
                  { id: text },
                  { action: text },
                  { actorId: text },
                  { targetId: text },
                  { reason: text },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
  }
}

const id = z.string().uuid();
const operations = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id, disabled: z.boolean() }),
  z.object({ kind: z.literal("view-session"), id }),
  z.object({
    kind: z.literal("club"),
    id: id.optional(),
    name: z.string().min(1).max(150),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    tagline: z.string().max(300),
    description: z.string().max(10000),
    category: z.string().max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  }),
  z.object({ kind: z.literal("claim"), id, approved: z.boolean() }),
  z.object({
    kind: z.literal("membership"),
    clubId: id,
    userId: id,
    isOwner: z.boolean(),
    permissions: z.array(z.enum(clubPermissions)).max(clubPermissions.length),
  }),
  z.object({
    kind: z.literal("round"),
    id: id.optional(),
    clubId: id,
    name: z.string().min(1).max(100),
    order: z.number().int().min(0),
    anonymousReview: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("question"),
    id: id.optional(),
    clubId: id,
    prompt: z.string().min(1).max(3000),
    type: z.enum(["ESSAY", "FILE_UPLOAD", "MULTIPLE_CHOICE"]),
    required: z.boolean(),
    wordLimit: z.number().int().min(1).max(10000).nullable(),
  }),
  z.object({
    kind: z.literal("interview"),
    clubId: id,
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    location: z.string().min(1).max(500),
    capacity: z.number().int().min(1).max(100),
  }),
  z.object({
    kind: z.literal("application"),
    id,
    expectedStatus: z.enum([
      "SUBMITTED",
      "IN_REVIEW",
      "INTERVIEWING",
      "ACCEPTED",
      "REJECTED",
      "WAITLISTED",
    ]),
    status: z.enum([
      "IN_REVIEW",
      "INTERVIEWING",
      "ACCEPTED",
      "REJECTED",
      "WAITLISTED",
    ]),
  }),
  z.object({
    kind: z.literal("meeting"),
    id: id.optional(),
    clubId: id,
    title: z.string().min(1).max(200),
    date: z.coerce.date(),
    location: z.string().min(1).max(500),
    isPublic: z.boolean(),
  }),
  z.object({
    kind: z.literal("task"),
    id: id.optional(),
    clubId: id,
    title: z.string().min(1).max(200),
    description: z.string().max(10000),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
    dueAt: z.coerce.date().nullable().optional(),
  }),
  z.object({
    kind: z.literal("content"),
    key: z.string().min(1).max(100),
    value: z.record(z.unknown()),
  }),
]);
export async function changePlatformResource(input: unknown, reason: string) {
  const actor = await requirePlatformAdmin();
  const data = operations.parse(input);
  const justification = z.string().trim().min(10).max(1000).parse(reason);
  if (data.kind === "content" && JSON.stringify(data.value).length > 4_000_000)
    throw new Error("Content exceeds the 4 MB limit.");
  return prisma.$transaction(async (tx) => {
    let targetId = "";
    let auditedClubId = "clubId" in data ? data.clubId : undefined;
    switch (data.kind) {
      case "view-session": {
        const session = await tx.platformViewSession.findUnique({
          where: { id: data.id },
        });
        if (!session) throw new Error("View session unavailable.");
        const ended = await tx.platformViewSession.updateMany({
          where: { id: session.id, endedAt: null },
          data: { endedAt: new Date() },
        });
        if (!ended.count) throw new Error("View session already ended.");
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "platform.view-as.end",
            targetId: session.targetUserId,
            clubId: session.clubId,
            reason: justification,
            details: { sessionId: session.id, terminatedByAdmin: true },
          },
        });
        targetId = session.id;
        auditedClubId = session.clubId ?? undefined;
        break;
      }
      case "user": {
        if (data.id === actor.id && data.disabled)
          throw new Error("You cannot suspend your own administrator account.");
        if (
          data.disabled &&
          (await tx.platformAdmin.findUnique({ where: { userId: data.id } }))
        )
          throw new Error(
            "Administrator suspension requires revoking the protected grant first.",
          );
        if (data.disabled) {
          const owned = await tx.clubMember.findMany({
            where: { userId: data.id, isOwner: true },
            select: { clubId: true },
          });
          for (const membership of owned) {
            await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${membership.clubId} FOR UPDATE`;
            if (
              !(await tx.clubMember.count({
                where: {
                  clubId: membership.clubId,
                  isOwner: true,
                  userId: { not: data.id },
                  user: { disabledAt: null },
                },
              }))
            )
              throw new Error(
                "Assign another active club owner before suspending this account.",
              );
          }
        }
        await tx.user.update({
          where: { id: data.id },
          data: { disabledAt: data.disabled ? new Date() : null },
        });
        targetId = data.id;
        break;
      }
      case "club": {
        const { kind, id, ...fields } = data;
        const record = id
          ? await tx.club.update({ where: { id }, data: fields })
          : await tx.club.create({ data: fields });
        targetId = record.id;
        break;
      }
      case "claim": {
        const claim = await tx.clubClaim.findUnique({ where: { id: data.id } });
        if (!claim || claim.status !== "PENDING")
          throw new Error("Claim is no longer pending.");
        auditedClubId = claim.clubId;
        await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${claim.clubId} FOR UPDATE`;
        if (data.approved) {
          const club = await tx.club.findUnique({
            where: { id: claim.clubId },
          });
          const claimant = await tx.user.findUnique({
            where: { id: claim.userId },
          });
          if (!claimant || claimant.disabledAt)
            throw new Error("Claimant account unavailable.");
          if (
            !club ||
            club.claimedAt ||
            (await tx.clubMember.count({
              where: { clubId: claim.clubId, isOwner: true },
            }))
          )
            throw new Error(
              "Club already has an owner. Resolve access through membership management.",
            );
        }
        const result = await tx.clubClaim.updateMany({
          where: { id: claim.id, status: "PENDING" },
          data: { status: data.approved ? "APPROVED" : "REJECTED" },
        });
        if (result.count !== 1)
          throw new Error("Claim changed. Reload before deciding.");
        if (data.approved) {
          await tx.club.update({
            where: { id: claim.clubId },
            data: { claimedAt: new Date() },
          });
          await tx.clubMember.upsert({
            where: {
              userId_clubId: { userId: claim.userId, clubId: claim.clubId },
            },
            create: {
              userId: claim.userId,
              clubId: claim.clubId,
              isOwner: true,
            },
            update: { isOwner: true },
          });
        }
        targetId = claim.id;
        break;
      }
      case "membership": {
        await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${data.clubId} FOR UPDATE`;
        const targetAccount = await tx.user.findUnique({ where: { id: data.userId }, select: { disabledAt: true } });
        if (!targetAccount || (targetAccount.disabledAt && (data.isOwner || data.permissions.length))) throw new Error("Granting access requires an active account.");
        const where = {
          userId_clubId: { userId: data.userId, clubId: data.clubId },
        };
        const old = await tx.clubMember.findUnique({ where });
        if (
          old?.isOwner &&
          !data.isOwner &&
          (await tx.clubMember.count({
            where: { clubId: data.clubId, isOwner: true, user: { disabledAt: null } },
          })) <= 1
        )
          throw new Error("Assign another owner first.");
        if (data.isOwner)
          await tx.club.update({
            where: { id: data.clubId },
            data: { claimedAt: new Date() },
          });
        const { kind, ...fields } = data;
        const record = await tx.clubMember.upsert({
          where,
          create: fields,
          update: { isOwner: fields.isOwner, permissions: fields.permissions },
        });
        targetId = record.id;
        const person = await tx.user.findUnique({
          where: { id: data.userId },
          select: { email: true },
        });
        if (person)
          await tx.clubInvitation.updateMany({
            where: {
              clubId: data.clubId,
              email: person.email.toLowerCase(),
              acceptedAt: null,
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        break;
      }
      case "question": {
        const { kind, id, ...fields } = data;
        if (
          id &&
          !(await tx.applicationQuestion.findFirst({
            where: { id, clubId: data.clubId },
          }))
        )
          throw new Error("Question unavailable.");
        if (
          id &&
          (await tx.applicationAnswer.count({ where: { questionId: id } }))
        )
          throw new Error(
            "Answered questions must retain their original requirements.",
          );
        const record = id
          ? await tx.applicationQuestion.update({ where: { id }, data: fields })
          : await tx.applicationQuestion.create({ data: fields });
        targetId = record.id;
        break;
      }
      case "interview": {
        if (
          data.endTime <= data.startTime ||
          !(await tx.club.findUnique({ where: { id: data.clubId } }))
        )
          throw new Error("Check club and interview times.");
        const { kind, ...fields } = data;
        const record = await tx.interviewSlot.create({ data: fields });
        targetId = record.id;
        break;
      }
      case "application": {
        const result = await tx.application.updateMany({
          where: { id: data.id, status: data.expectedStatus },
          data: { status: data.status },
        });
        if (result.count !== 1)
          throw new Error("Application changed. Reload before deciding.");
        targetId = data.id;
        break;
      }
      case "round": {
        const { kind, id, ...fields } = data;
        if (
          id &&
          !(await tx.pipelineRound.findFirst({
            where: { id, clubId: data.clubId },
          }))
        )
          throw new Error("Round unavailable.");
        const old = id
          ? await tx.pipelineRound.findUnique({ where: { id } })
          : null;
        if (old && old.name !== data.name)
          throw new Error(
            "Round names with evaluation history must remain stable; create a new round instead.",
          );
        const record = id
          ? await tx.pipelineRound.update({ where: { id }, data: fields })
          : await tx.pipelineRound.create({ data: fields });
        targetId = record.id;
        break;
      }
      case "meeting": {
        const { kind, id, ...values } = data;
        const fields = {
          ...values,
          audience: values.isPublic ? "RECRUITMENT" : "MEMBERS",
        };
        if (
          id &&
          !(await tx.meeting.findFirst({ where: { id, clubId: data.clubId } }))
        )
          throw new Error("Meeting unavailable.");
        const record = id
          ? await tx.meeting.update({
              where: { id },
              data: { ...fields, revision: { increment: 1 } },
            })
          : await tx.meeting.create({ data: fields });
        if (id)
          await tx.meetingCheckInToken.deleteMany({ where: { meetingId: id } });
        targetId = record.id;
        break;
      }
      case "task": {
        const { kind, id, ...fields } = data;
        if (
          id &&
          !(await tx.clubTask.findFirst({ where: { id, clubId: data.clubId } }))
        )
          throw new Error("Task unavailable.");
        const record = id
          ? await tx.clubTask.update({
              where: { id },
              data: { ...fields, revision: { increment: 1 } },
            })
          : await tx.clubTask.create({ data: fields });
        targetId = record.id;
        break;
      }
      case "content": {
        if (data.key === "demo.seed") readDemoTemplate(data.value);
        const value = JSON.parse(JSON.stringify(data.value));
        const record = await tx.platformContent.upsert({
          where: { key: data.key },
          create: { key: data.key, value },
          update: { value },
        });
        targetId = record.id;
        break;
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `platform.${data.kind}.change`,
        targetId,
        reason: justification,
        clubId: auditedClubId,
        details:
          data.kind === "content"
            ? {
                kind: data.kind,
                key: data.key,
                bytes: JSON.stringify(data.value).length,
              }
            : JSON.parse(JSON.stringify(data)),
      },
    });
    return { success: true, targetId };
  });
}

/** Safe view-as: read-only snapshot, no target cookies/tokens and no delegated mutations. */
export async function inspectPlatformUser(userId: string, reason: string) {
  const actor = await requirePlatformAdmin();
  id.parse(userId);
  z.string().trim().min(10).max(1000).parse(reason);
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "platform.user.inspect",
      targetId: userId,
      reason,
    },
  });
  return prisma.user.findUnique({
    where: { id: userId },
    omit: { passwordHash: true },
    include: {
      studentProfile: { include: { experiences: true } },
      memberships: true,
      applications: { include: { answers: true, evaluations: true } },
      attendances: true,
    },
  });
}

/** Expanded records are fetched only after an explicit, audited inspection. */
export async function inspectPlatformRecord(
  resource: PlatformResource,
  recordId: string,
) {
  const actor = await requirePlatformAdmin();
  resources.parse(resource);
  id.parse(recordId);
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "platform.record.inspect",
      targetId: recordId,
      details: { resource },
    },
  });
  if (resource === "users")
    return prisma.user.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        email: true,
        disabledAt: true,
        createdAt: true,
        studentProfile: { include: { experiences: true } },
        memberships: { include: { club: { select: { name: true } } } },
      },
    });
  if (resource === "applications")
    return prisma.application.findUnique({
      where: { id: recordId },
      include: {
        answers: { include: { question: true } },
        evaluations: true,
        interviewRecords: true,
        round: true,
        club: { select: { name: true } },
        student: {
          select: {
            email: true,
            studentProfile: { include: { experiences: true } },
          },
        },
      },
    });
  if (resource === "meetings")
    return prisma.meeting.findUnique({
      where: { id: recordId },
      include: {
        attendances: {
          select: {
            id: true,
            checkedInAt: true,
            student: { select: { email: true } },
          },
        },
      },
    });
  if (resource === "tasks")
    return prisma.clubTask.findUnique({
      where: { id: recordId },
      include: {
        assignments: {
          include: {
            recipient: { select: { email: true } },
            files: {
              where: { submitted: true },
              select: { id: true, name: true, size: true },
            },
          },
        },
      },
    });
  throw new Error("Expanded inspection is unavailable for this resource.");
}
