"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/utils/prisma";
import {
  requireAuth,
  requireClubMembership,
  requireClubPermission,
} from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import {
  taskAudienceSchema,
  taskInputSchema,
  matchesTaskAudience,
  submissionSchema,
  validateTaskSubmission,
  taskFileSchema,
  type TaskInput,
} from "@/lib/tasks";
import type { Prisma } from "@prisma/client";
const uuid = z.string().uuid();
const memberSelect = {
  id: true,
  groups: true,
  cohort: true,
  role: true,
  user: {
    select: {
      id: true,
      studentProfile: {
        select: { firstName: true, lastName: true, gradYear: true },
      },
      email: true,
    },
  },
} as const;
const assignmentInclude = {
  recipient: { select: memberSelect.user.select },
  member: { select: memberSelect },
  files: {
    where: { submitted: true },
    select: { id: true, name: true, size: true },
  },
} as const;
async function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Task file storage is unavailable. Contact your club manager.",
    );
  const storage = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
  const { data, error } = await storage.getBucket("task-submissions");
  if (error || !data || data.public)
    throw new Error("Private task storage is not configured.");
  return storage.from("task-submissions");
}
async function currentMember(
  tx: Prisma.TransactionClient,
  clubId: string,
  userId: string,
  manage = false,
) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
  const member = await tx.clubMember.findUnique({
    where: { userId_clubId: { clubId, userId } },
  });
  if (!member || (manage && !hasPermission(member, "tasks.manage")))
    throw new Error("Task access unavailable.");
  return member;
}
async function ownedAssignment(assignmentId: string) {
  uuid.parse(assignmentId);
  const { user } = await requireAuth();
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: assignmentId },
    include: { member: true, task: true },
  });
  if (
    !assignment ||
    assignment.member?.userId !== user.id ||
    assignment.member.clubId !== assignment.task.clubId
  )
    throw new Error("Assignment unavailable.");
  return { user, assignment };
}
export async function getTaskWorkspace(clubId: string) {
  uuid.parse(clubId);
  const { membership } = await requireClubMembership(clubId);
  const manage = hasPermission(membership, "tasks.manage");
  const tasks = await prisma.clubTask.findMany({
    where: {
      clubId,
      ...(manage ? {} : { assignments: { some: { memberId: membership.id } } }),
    },
    include: {
      assignments: {
        where: manage ? {} : { memberId: membership.id },
        include: assignmentInclude,
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return {
    clubId,
    manage,
    memberId: membership.id,
    tasks: tasks.map((task) => ({
      ...task,
      assignments: task.assignments.map(({ recipient, ...assignment }) => ({
        ...assignment,
        member: assignment.member ?? {
          id: assignment.userId,
          groups: [],
          cohort: null,
          role: "GENERAL_MEMBER" as const,
          user: recipient,
        },
      })),
    })),
    members: manage
      ? await prisma.clubMember.findMany({
          where: { clubId },
          select: memberSelect,
        })
      : [],
  };
}
export async function saveTask(input: TaskInput) {
  const data = taskInputSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["tasks.manage"]);
  return prisma.$transaction(async (tx) => {
    await currentMember(tx, data.clubId, user.id, true);
    if (data.projectId) {
      if (
        data.kind !== "TASK" ||
        data.projectId === data.id ||
        !(await tx.clubTask.findFirst({
          where: { id: data.projectId, clubId: data.clubId, kind: "PROJECT" },
        }))
      )
        throw new Error("Choose a project in this club.");
    }
    const existing = data.id
      ? await tx.clubTask.findFirst({
          where: { id: data.id, clubId: data.clubId },
        })
      : null;
    if (data.id && !existing) throw new Error("Task unavailable.");
    if (existing && existing.kind !== data.kind)
      throw new Error("Task type cannot change after creation.");
    const { id, revision, audience, ...fields } = data;
    const values = {
      ...fields,
      dueAt: fields.dueAt ? new Date(fields.dueAt) : null,
      audience,
    };
    if (
      existing &&
      JSON.stringify(taskAudienceSchema.parse(existing.audience)) !==
        JSON.stringify(audience)
    )
      throw new Error(
        "Audience is fixed after assignment. Create a new task for a different audience.",
      );
    let taskId = id;
    if (id) {
      const updated = await tx.clubTask.updateMany({
        where: { id, clubId: data.clubId, revision },
        data: { ...values, revision: { increment: 1 } },
      });
      if (!updated.count)
        throw new Error("This task changed. Refresh before saving.");
    } else {
      const members = await tx.clubMember.findMany({
        where: { clubId: data.clubId },
        select: memberSelect,
      });
      if (audience.members.some((id) => !members.some((m) => m.id === id)))
        throw new Error("An assignee is no longer a member of this club.");
      const recipients = members.filter((m) =>
        matchesTaskAudience(
          { ...m, gradYear: m.user.studentProfile?.gradYear ?? null },
          audience,
        ),
      );
      if (!recipients.length)
        throw new Error("Choose an audience with at least one current member.");
      const task = await tx.clubTask.create({
        data: {
          ...values,
          assignments: {
            create: recipients.map((m) => ({
              memberId: m.id,
              userId: m.user.id,
            })),
          },
        },
      });
      taskId = task.id;
    }
    // Audience is a snapshot. Editing content never silently removes submitted work or adds recipients.
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        clubId: data.clubId,
        action: "club.task.save",
        targetId: taskId!,
      },
    });
    return { id: taskId! };
  });
}
export async function updateTaskMember(input: {
  clubId: string;
  memberId: string;
  groups: string[];
  cohort: string | null;
}) {
  const data = z
    .object({
      clubId: uuid,
      memberId: uuid,
      groups: z.array(z.string().trim().min(1).max(80)).max(20),
      cohort: z.string().trim().min(1).max(80).nullable(),
    })
    .parse(input);
  const { user } = await requireClubPermission(data.clubId, ["members.manage"]);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${data.clubId} FOR UPDATE`;
    const manager = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    });
    if (!manager || !hasPermission(manager, "members.manage"))
      throw new Error("Membership access unavailable.");
    const result = await tx.clubMember.updateMany({
      where: { id: data.memberId, clubId: data.clubId },
      data: { groups: [...new Set(data.groups)], cohort: data.cohort },
    });
    if (!result.count) throw new Error("Member unavailable.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        clubId: data.clubId,
        action: "club.member.targeting.update",
        targetId: data.memberId,
      },
    });
    return { success: true };
  });
}
export async function viewTask(assignmentId: string) {
  const { assignment } = await ownedAssignment(assignmentId);
  await prisma.taskAssignment.updateMany({
    where: { id: assignment.id, viewedAt: null },
    data: { viewedAt: new Date() },
  });
  return { success: true };
}
export async function submitTask(input: z.infer<typeof submissionSchema>) {
  const data = submissionSchema.parse(input);
  const { user, assignment } = await ownedAssignment(data.assignmentId);
  validateTaskSubmission(assignment.task.requirements, data);
  const files = await prisma.taskFile.findMany({
    where: { id: { in: data.fileIds }, assignmentId: assignment.id },
  });
  if (files.length !== new Set(data.fileIds).size)
    throw new Error("A file is unavailable. Upload it again.");
  for (const file of files) {
    const { data: objects, error } = await (
      await storage()
    ).list(file.path.slice(0, file.path.lastIndexOf("/")), {
      search: file.path.split("/").pop()!,
      limit: 10,
    });
    const object = objects?.find((o) => o.name === file.path.split("/").pop());
    if (
      error ||
      !object ||
      Number(object.metadata?.size) !== file.size ||
      object.metadata?.mimetype !== file.mime
    )
      throw new Error("File upload is incomplete or invalid. Upload it again.");
  }
  return prisma.$transaction(async (tx) => {
    await currentMember(tx, assignment.task.clubId, user.id);
    await tx.$queryRaw`SELECT id FROM "ClubTask" WHERE id=${assignment.taskId} FOR UPDATE`;
    const task = await tx.clubTask.findUniqueOrThrow({
      where: { id: assignment.taskId },
    });
    if (task.status === "DONE" || task.kind !== "TASK")
      throw new Error("This assignment is closed.");
    validateTaskSubmission(task.requirements, data);
    const updated = await tx.taskAssignment.updateMany({
      where: {
        id: data.assignmentId,
        member: { userId: user.id },
        revision: data.revision,
        reviewedAt: null,
      },
      data: {
        text: data.text,
        link: data.link,
        submittedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new Error(
        "This submission changed or was reviewed. Refresh before submitting.",
      );
    await tx.taskFile.updateMany({
      where: { assignmentId: assignment.id },
      data: { submitted: false },
    });
    await tx.taskFile.updateMany({
      where: { assignmentId: assignment.id, id: { in: data.fileIds } },
      data: { submitted: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        clubId: task.clubId,
        action: "club.task.submit",
        targetId: assignment.id,
      },
    });
    return { success: true };
  });
}
export async function reviewTask(input: {
  assignmentId: string;
  revision: number;
  feedback: string;
  reopen: boolean;
}) {
  const data = z
    .object({
      assignmentId: uuid,
      revision: z.number().int().nonnegative(),
      feedback: z.string().max(5000),
      reopen: z.boolean(),
    })
    .parse(input);
  await requireAuth();
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: data.assignmentId },
    select: { task: { select: { clubId: true, kind: true } } },
  });
  if (!assignment) throw new Error("Assignment unavailable.");
  const { user } = await requireClubPermission(assignment.task.clubId, [
    "tasks.manage",
  ]);
  return prisma.$transaction(async (tx) => {
    await currentMember(tx, assignment.task.clubId, user.id, true);
    const updated = await tx.taskAssignment.updateMany({
      where: {
        id: data.assignmentId,
        revision: data.revision,
        ...(assignment.task.kind === "TASK"
          ? { submittedAt: { not: null } }
          : {}),
      },
      data: {
        reviewedAt: data.reopen ? null : new Date(),
        reviewedBy: data.reopen ? null : user.id,
        feedback: data.feedback,
        revision: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new Error(
        "Submission changed or is not yet submitted. Refresh and try again.",
      );
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        clubId: assignment.task.clubId,
        action: data.reopen ? "club.task.reopen" : "club.task.review",
        targetId: data.assignmentId,
      },
    });
    return { success: true };
  });
}
export async function uploadTaskFile(input: z.infer<typeof taskFileSchema>) {
  const data = taskFileSchema.parse(input);
  const { assignment } = await ownedAssignment(data.assignmentId);
  if (
    assignment.reviewedAt ||
    assignment.task.status === "DONE" ||
    assignment.task.kind !== "TASK"
  )
    throw new Error("This assignment is closed.");
  const bucket = await storage();
  const path = `${assignment.id}/${randomUUID()}`;
  const file = await prisma.$transaction(async (tx) => {
    await currentMember(tx, assignment.task.clubId, assignment.userId);
    const latest = await tx.taskAssignment.findUnique({
      where: { id: assignment.id },
      include: { task: true },
    });
    if (!latest || latest.reviewedAt || latest.task.status === "DONE")
      throw new Error("This assignment is closed.");
    if (
      (await tx.taskFile.count({
        where: {
          assignmentId: assignment.id,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      })) >= 30
    )
      throw new Error("Daily upload limit reached. Try again tomorrow.");
    return tx.taskFile.create({
      data: {
        assignmentId: assignment.id,
        name: data.name,
        path,
        size: data.size,
        mime: data.mime,
      },
    });
  });
  const { data: upload, error } = await bucket.createSignedUploadUrl(path, {
    upsert: false,
  });
  if (error || !upload) {
    await prisma.taskFile.delete({ where: { id: file.id } });
    throw new Error("Could not prepare upload. Try again.");
  }
  return { id: file.id, url: upload.signedUrl };
}
export async function downloadTaskFile(fileId: string) {
  uuid.parse(fileId);
  const { user } = await requireAuth();
  const file = await prisma.taskFile.findUnique({
    where: { id: fileId },
    include: { assignment: { include: { member: true, task: true } } },
  });
  if (!file || !file.submitted) throw new Error("File unavailable.");
  const membership = await prisma.clubMember.findUnique({
    where: {
      userId_clubId: { userId: user.id, clubId: file.assignment.task.clubId },
    },
  });
  if (
    !membership ||
    (file.assignment.member?.userId !== user.id &&
      !hasPermission(membership, "tasks.manage"))
  )
    throw new Error("File unavailable.");
  const { data, error } = await (
    await storage()
  ).createSignedUrl(file.path, 60, { download: file.name });
  if (error || !data) throw new Error("Could not download file. Try again.");
  return { url: data.signedUrl };
}
