"use server";
import { z } from "zod";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { hasPermission, type ClubPermission } from "@/lib/permissions";
import {
  applicationSettingsSchema,
  pipelineSettingsSchema,
} from "@/lib/club-settings";
import { revalidatePath, revalidateTag } from "next/cache";
async function authorize(
  tx: AppTransactionClient,
  clubId: string,
  userId: string,
  permission: ClubPermission,
) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
  const [member, user] = await Promise.all([
    tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } }),
    tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } }),
  ]);
  if (!user || user.disabledAt || !hasPermission(member, permission))
    throw new Error("Settings access changed. Reload before editing.");
}
function invalidate(clubId: string) {
  revalidateTag("club-directory");
  revalidatePath(`/club/${clubId}`);
  revalidatePath(`/club/${clubId}/workspace`);
  revalidatePath("/");
}
export async function getApplicationSettings(clubId: string) {
  z.string().uuid().parse(clubId);
  await requireClubPermission(clubId, ["application.manage"]);
  return prisma.club.findUniqueOrThrow({
    where: { id: clubId },
    select: {
      name: true,
      applicationOpen: true,
      applicationDeadline: true,
      applicationVersion: true,
      questions: {
        where: { archivedAt: null },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          prompt: true,
          type: true,
          required: true,
          wordLimit: true,
          options: true,
        },
      },
    },
  });
}
export async function saveApplicationSettings(input: unknown) {
  const data = applicationSettingsSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, [
    "application.manage",
  ]);
  const result = await prisma.$transaction(
    async (tx) => {
      await authorize(tx, data.clubId, user.id, "application.manage");
      const club = await tx.club.findUniqueOrThrow({
        where: { id: data.clubId },
      });
      if (club.applicationVersion !== data.version)
        throw new Error(
          "Application configuration changed. Reload before saving.",
        );
      const current = await tx.applicationQuestion.findMany({
        where: { clubId: data.clubId, archivedAt: null },
        include: { _count: { select: { answers: true } } },
      });
      for (const q of data.questions) {
        if (
          q.type === "MULTIPLE_CHOICE" &&
          q.options.length === 0 &&
          !current.some(
            (saved) =>
              saved.id === q.id &&
              saved.type === "MULTIPLE_CHOICE" &&
              saved.options.length === 0,
          )
        )
          throw new Error(
            "New multiple-choice questions need at least two distinct options.",
          );
      }
      const keep = new Set(data.questions.map((q) => q.id));
      for (const q of current.filter((q) => !keep.has(q.id))) {
        // Retain answers and their original prompts. Never cascade away applicant history.
        if (q._count.answers)
          await tx.applicationQuestion.update({
            where: { id: q.id },
            data: { archivedAt: new Date() },
          });
        else await tx.applicationQuestion.delete({ where: { id: q.id } });
      }
      for (const [order, q] of data.questions.entries()) {
        const saved = current.find((x) => x.id === q.id);
        const fields = {
          prompt: q.prompt,
          type: q.type,
          required: q.required,
          wordLimit: q.type === "ESSAY" ? q.wordLimit : null,
          options: q.type === "MULTIPLE_CHOICE" ? q.options : [],
          order,
        };
        if (saved) {
          if (
            saved._count.answers &&
            (saved.type !== q.type ||
              JSON.stringify(saved.options) !== JSON.stringify(fields.options))
          )
            throw new Error(
              "A question with saved answers cannot change type or choices. Add a replacement question instead.",
            );
          if (
            Object.entries(fields).some(
              ([key, value]) =>
                JSON.stringify(saved[key as keyof typeof saved]) !==
                JSON.stringify(value),
            )
          )
            await tx.applicationQuestion.update({
              where: { id: q.id },
              data: fields,
            });
        } else
          await tx.applicationQuestion.create({
            data: { id: q.id, clubId: data.clubId, ...fields },
          });
      }
      await tx.club.update({
        where: { id: data.clubId },
        data: {
          applicationOpen: data.open,
          applicationDeadline: data.deadline ? new Date(data.deadline) : null,
          applicationVersion: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "club.application.configure",
          targetId: data.clubId,
          clubId: data.clubId,
          details: {
            questionCount: data.questions.length,
            open: data.open,
            version: data.version + 1,
          },
        },
      });
      return { version: data.version + 1 };
    },
    { timeout: 30000 },
  );
  invalidate(data.clubId);
  return result;
}
export async function getPipelineSettings(clubId: string) {
  z.string().uuid().parse(clubId);
  await requireClubPermission(clubId, ["recruitment.manage"]);
  return prisma.club.findUniqueOrThrow({
    where: { id: clubId },
    select: {
      pipelineVersion: true,
      pipelineRounds: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          archivedAt: true,
          anonymousReview: true,
          configuration: true,
          _count: {
            select: {
              applications: true,
              interviewRooms: true,
              interviewRecords: true,
              votingSessions: true,
              scheduledBookings: true,
            },
          },
        },
      },
    },
  });
}
export async function savePipelineSettings(input: unknown) {
  const data = pipelineSettingsSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, [
    "recruitment.manage",
  ]);
  const result = await prisma.$transaction(
    async (tx) => {
      await authorize(tx, data.clubId, user.id, "recruitment.manage");
      const club = await tx.club.findUniqueOrThrow({
        where: { id: data.clubId },
      });
      if (club.pipelineVersion !== data.version)
        throw new Error("Recruiting pipeline changed. Reload before saving.");
      const current = await tx.pipelineRound.findMany({
        where: { clubId: data.clubId },
        include: {
          screeningRule: true,
          _count: {
            select: {
              applications: true,
              interviewRooms: true,
              interviewRecords: true,
              votingSessions: true,
              scheduledBookings: true,
            },
          },
        },
      });
      // Never let a different round reuse a label and overwrite an evaluation.
      const historicalLabels = await tx.evaluation.findMany({
        where: { application: { clubId: data.clubId } },
        select: { round: true },
        distinct: ["round"],
      });
      const historicalNames = new Set(
        historicalLabels.map((e) => e.round.toLowerCase()),
      );
      for (const proposed of data.rounds) {
        const existing = current.find((r) => r.id === proposed.id);
        if (
          existing &&
          existing.name !== proposed.name &&
          historicalLabels.some((e) => e.round === proposed.name)
        )
          throw new Error(
            "That round name belongs to existing review history. Choose a new name.",
          );
        const named = current.find(
          (r) => r.name.toLowerCase() === proposed.name.toLowerCase(),
        );
        if (
          (named && named.id !== proposed.id) ||
          (historicalNames.has(proposed.name.toLowerCase()) &&
            named?.id !== proposed.id)
        )
          throw new Error(
            "That round name belongs to existing review history. Choose a new name.",
          );
      }
      const keep = new Set(data.rounds.map((r) => r.id));
      for (const r of current.filter((r) => !r.archivedAt && !keep.has(r.id))) {
        if (
          await tx.application.count({
            where: {
              roundId: r.id,
              status: { notIn: ["ACCEPTED", "REJECTED"] },
            },
          })
        )
          throw new Error(
            `Move active applicants out of ${r.name} before removing this round.`,
          );
        if (
          (await tx.interviewRoom.count({
            where: { roundId: r.id, isOpen: true },
          })) ||
          (await tx.votingSession.count({
            where: { roundId: r.id, state: { not: "COMPLETED" } },
          }))
        )
          throw new Error(
            `Close interview rooms and finish voting sessions before archiving ${r.name}.`,
          );
        if (
          Object.values(r._count).some(Boolean) ||
          r.screeningRule ||
          historicalNames.has(r.name.toLowerCase())
        )
          await tx.pipelineRound.update({
            where: { id: r.id },
            data: { archivedAt: new Date() },
          });
        else await tx.pipelineRound.delete({ where: { id: r.id } });
      }
      for (const [order, r] of data.rounds.entries()) {
        const saved = current.find((x) => x.id === r.id);
        if (saved?.archivedAt)
          throw new Error("Archived rounds cannot be reused. Add a new round.");
        const fields = {
          name: r.name,
          type: r.type,
          order,
          configuration: r.configuration,
        };
        if (saved) {
          if (
            saved.type !== r.type &&
            (saved._count.interviewRooms ||
              saved._count.interviewRecords ||
              saved._count.votingSessions)
          )
            throw new Error(
              `The type of ${saved.name} is protected by its interview or voting history.`,
            );
          if (saved.name !== r.name) {
            // Retain IDs, scores, notes and dates while following a renamed stage.
            // Ambiguous legacy labels without a canonical interview link stay intact.
            const uniqueLabel =
              current.filter((x) => x.name === saved.name).length === 1;
            await tx.evaluation.updateMany({
              where: {
                application: { clubId: data.clubId },
                round: saved.name,
                interviewRecords: {
                  ...(uniqueLabel ? {} : { some: { roundId: saved.id } }),
                  every: { roundId: saved.id },
                },
              },
              data: { round: r.name },
            });
          }
          await tx.pipelineRound.update({
            where: { id: r.id },
            data: {
              ...fields,
              configuration: {
                ...(saved.configuration as object),
                ...r.configuration,
              },
            },
          });
        } else
          await tx.pipelineRound.create({
            data: { id: r.id, clubId: data.clubId, ...fields },
          });
      }
      await tx.club.update({
        where: { id: data.clubId },
        data: { pipelineVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "club.pipeline.configure",
          targetId: data.clubId,
          clubId: data.clubId,
          details: {
            rounds: data.rounds.map((r) => ({
              id: r.id,
              name: r.name,
              type: r.type,
            })),
            version: data.version + 1,
          },
        },
      });
      return { version: data.version + 1 };
    },
    { timeout: 30000 },
  );
  invalidate(data.clubId);
  return result;
}
export async function saveClubPreferences(input: unknown) {
  const data = z
    .object({
      clubId: z.string().uuid(),
      isDiscoverable: z.boolean().optional(),
      invitationEmailEnabled: z.boolean().optional(),
    })
    .strict()
    .parse(input);
  const { user } = await requireClubPermission(data.clubId, ["club.settings"]);
  await prisma.$transaction(async (tx) => {
    await authorize(tx, data.clubId, user.id, "club.settings");
    const { clubId, ...fields } = data;
    await tx.club.update({ where: { id: clubId }, data: fields });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.preferences.configure",
        targetId: clubId,
        clubId,
        details: fields,
      },
    });
  });
  invalidate(data.clubId);
}
