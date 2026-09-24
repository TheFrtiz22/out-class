"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { readDemoTemplate } from "@/lib/demo/validate";
import { clubPermissions } from "@/lib/permissions";

const resources = z.enum([
  "users",
  "clubs",
  "claims",
  "memberships",
  "rounds",
  "questions",
  "interviews",
  "applications",
  "meetings",
  "tasks",
  "content",
  "audit",
]);
export type PlatformResource = z.infer<typeof resources>;
export async function readPlatformResource(input: PlatformResource, page = 0) {
  const actor = await requirePlatformAdmin();
  const resource = resources.parse(input);
  const skip = z.number().int().min(0).max(100000).parse(page) * 100;
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "platform.read", targetId: resource },
  });
  switch (resource) {
    case "users":
      return prisma.user.findMany({
        take: 100,
        skip,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, disabledAt: true, createdAt: true },
      });
    case "clubs":
      return prisma.club.findMany({
        take: 100,
        skip,
        orderBy: { name: "asc" },
      });
    case "claims":
      return prisma.clubClaim.findMany({
        take: 100,
        skip,
        orderBy: { createdAt: "desc" },
      });
    case "memberships":
      return prisma.clubMember.findMany({
        take: 100,
        skip,
        orderBy: { id: "asc" },
      });
    case "rounds":
      return prisma.pipelineRound.findMany({
        take: 100,
        skip,
        orderBy: { id: "asc" },
      });
    case "questions":
      return prisma.applicationQuestion.findMany({
        take: 100,
        skip,
        orderBy: { id: "asc" },
      });
    case "interviews":
      return prisma.interviewSlot.findMany({
        take: 100,
        skip,
        orderBy: { startTime: "desc" },
      });
    case "applications":
      return prisma.application.findMany({
        take: 100,
        skip,
        orderBy: { id: "asc" },
      });
    case "meetings":
      return prisma.event.findMany({
        take: 100,
        skip,
        orderBy: { date: "desc" },
      });
    case "tasks":
      return prisma.clubTask.findMany({
        take: 100,
        skip,
        orderBy: { createdAt: "desc" },
      });
    case "content":
      return prisma.platformContent.findMany({
        take: 100,
        skip,
        orderBy: { key: "asc" },
      });
    case "audit":
      return prisma.auditLog.findMany({
        take: 100,
        skip,
        orderBy: { createdAt: "desc" },
      });
  }
}

const id = z.string().uuid();
const operations = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id, disabled: z.boolean() }),
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
  return prisma.$transaction(async (tx) => {
    let targetId = "";
    switch (data.kind) {
      case "user": {
        if (data.id === actor.id && data.disabled)
          throw new Error("You cannot suspend your own administrator account.");
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
        const where = {
          userId_clubId: { userId: data.userId, clubId: data.clubId },
        };
        const old = await tx.clubMember.findUnique({ where });
        if (
          old?.isOwner &&
          !data.isOwner &&
          (await tx.clubMember.count({
            where: { clubId: data.clubId, isOwner: true },
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
        const { kind, id, ...fields } = data;
        if (
          id &&
          !(await tx.event.findFirst({ where: { id, clubId: data.clubId } }))
        )
          throw new Error("Meeting unavailable.");
        const record = id
          ? await tx.event.update({ where: { id }, data: fields })
          : await tx.event.create({ data: fields });
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
          ? await tx.clubTask.update({ where: { id }, data: fields })
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
        details: JSON.parse(JSON.stringify(data)),
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
