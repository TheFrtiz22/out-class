"use server";

import { lockOperationalClub } from "@/lib/club-suspension";
import type { AppTransactionClient } from "@/utils/prisma";
import { auditSupportAction } from "@/utils/support-audit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/utils/prisma";
import {
  requireAuth,
  requireClubMembership,
  requireClubPermission,
} from "@/utils/auth";
import { hasPermission, isActiveMembership } from "@/lib/permissions";
import {
  taskAudienceSchema,
  taskInputSchema,
  resolveTaskRecipients,
  assertRecipientPreview,
  reviewTaskSchema,
  bulkTaskSchema,
  bulkReviewSchema,
  type TaskAudience,
  submissionSchema,
  validateTaskSubmission,
  taskFileSchema,
  type TaskInput,
} from "@/lib/tasks";
import { taskNotifications } from "@/lib/task-notifications";
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
  await auditSupportAction("platform.impersonation.task-storage", "task-submissions");
  return storage.from("task-submissions");
}
async function currentMember(
  tx: AppTransactionClient,
  clubId: string,
  userId: string,
  manage = false,
) {
  await lockOperationalClub(tx, clubId);
  const member = await tx.clubMember.findUnique({
    where: { userId_clubId: { clubId, userId } },
  });
  if (!member || !isActiveMembership(member) || (manage && !hasPermission(member, "tasks.manage")))
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
    !isActiveMembership(assignment.member) ||
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
      project: { select: { id: true, title: true, clubId: true } },
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
    tasks: tasks.map(({project, ...task}) => ({
      ...task,
      project: project?.clubId === clubId ? {id:project.id,title:project.title} : null,
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
          where: { clubId, status: "ACTIVE", user: { disabledAt: null } },
          select: memberSelect,
        })
      : [],
  };
}
async function recipientsFor(tx: AppTransactionClient, clubId: string, audience: TaskAudience) {
  const members = await tx.clubMember.findMany({ where: { clubId, status: "ACTIVE", user: { disabledAt: null } }, select: memberSelect });
  if ([...audience.members, ...audience.excludeMembers].some(id => !members.some(member => member.id === id))) throw new Error("An assignee is no longer a member of this club.");
  let excluded: string[] = [];
  if (audience.excludeTasks.length) {
    const tasks = await tx.clubTask.findMany({ where: { clubId, id: { in: audience.excludeTasks } }, select: { id: true, assignments: { select: { memberId: true } } } });
    if (tasks.length !== new Set(audience.excludeTasks).size) throw new Error("Choose exclusion tasks in this club.");
    excluded = tasks.flatMap(task => task.assignments.flatMap(assignment => assignment.memberId ? [assignment.memberId] : []));
  }
  return resolveTaskRecipients(members, audience, excluded);
}
export async function previewTaskAudience(input: { clubId: string; audience: TaskInput["audience"] }) {
  const data = z.object({ clubId: uuid, audience: taskAudienceSchema }).parse(input);
  const { user } = await requireClubPermission(data.clubId, ["tasks.manage"]);
  return prisma.$transaction(async tx => {
    await currentMember(tx, data.clubId, user.id, true);
    return (await recipientsFor(tx, data.clubId, data.audience)).map(({member,groupLabel}) => ({member,groupLabel}));
  });
}
export async function saveTask(input: TaskInput) {
  const data = taskInputSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["tasks.manage"]);
  return prisma.$transaction(async tx => {
    await currentMember(tx, data.clubId, user.id, true);
    if (data.projectId && (data.kind !== "TASK" || data.projectId === data.id || !(await tx.clubTask.findFirst({ where: { id: data.projectId, clubId: data.clubId, kind: "PROJECT" } })))) throw new Error("Choose a project in this club.");
    const existing = data.id ? await tx.clubTask.findFirst({ where: { id: data.id, clubId: data.clubId } }) : null;
    if (data.id && !existing) throw new Error("Task unavailable.");
    if (existing && existing.kind !== data.kind) throw new Error("Task type cannot change after creation.");
    if (existing && existing.status !== "DRAFT" && data.status === "DRAFT") throw new Error("An assigned task cannot become a draft.");
    if (existing && existing.status !== "DRAFT" && JSON.stringify(taskAudienceSchema.parse(existing.audience)) !== JSON.stringify(data.audience)) throw new Error("Audience is fixed after assignment. Create a new task for a different audience.");
    const { id, revision, audience, expectedRecipients, ...fields } = data;
    const values = { ...fields, dueAt: fields.dueAt ? new Date(fields.dueAt) : null, audience };
    const assigning = data.status !== "DRAFT" && (!existing || existing.status === "DRAFT");
    const recipients = assigning ? await recipientsFor(tx, data.clubId, audience) : [];
    if (assigning) {
      if (!recipients.length) throw new Error("Choose an audience with at least one current member.");
      assertRecipientPreview(recipients, expectedRecipients);
    }
    const assignments = recipients.map(({member,groupLabel}) => ({memberId: member.id, userId: member.user.id, groupLabel}));
    let taskId = id;
    if (id) {
      const updated = await tx.clubTask.updateMany({ where: { id, clubId: data.clubId, revision }, data: { ...values, revision: { increment: 1 } } });
      if (!updated.count) throw new Error("This task changed. Refresh before saving.");
      if (assigning) await tx.taskAssignment.createMany({data: assignments.map(assignment=>({...assignment,taskId:id}))});
    } else {
      const task = await tx.clubTask.create({ data: { ...values, assignments: { create: assignments } } });
      taskId = task.id;
    }
    await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,action:data.status === "DRAFT" ? "club.task.draft" : "club.task.save",targetId:taskId!}});
    return {id:taskId!};
  });
}
export async function bulkUpdateTasks(input: z.input<typeof bulkTaskSchema>) {
  const data = bulkTaskSchema.parse(input);
  const {user} = await requireClubPermission(data.clubId,["tasks.manage"]);
  return prisma.$transaction(async tx => {
    await currentMember(tx,data.clubId,user.id,true);
    if (new Set(data.tasks.map(task=>task.id)).size !== data.tasks.length) throw new Error("Choose each task once.");
    for (const task of data.tasks) {
      const result = await tx.clubTask.updateMany({where:{id:task.id,clubId:data.clubId,revision:task.revision,status:{not:"DRAFT"}},data:{...(data.action === "CLOSE" ? {status:"DONE"} : {dueAt:data.dueAt ? new Date(data.dueAt):null}),revision:{increment:1}}});
      if (!result.count) throw new Error("A task changed or is unavailable. Refresh before continuing.");
      await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,action:data.action === "CLOSE" ? "club.task.close" : "club.task.due",targetId:task.id}});
    }
    return {success:true};
  });
}
export async function addTaskRecipients(input: {clubId:string;taskId:string;revision:number;audience:TaskInput["audience"];expectedRecipients:string[]}) {
  const data=z.object({clubId:uuid,taskId:uuid,revision:z.number().int().nonnegative(),audience:taskAudienceSchema,expectedRecipients:z.array(uuid).max(1000)}).parse(input);
  const {user}=await requireClubPermission(data.clubId,["tasks.manage"]);
  return prisma.$transaction(async tx=>{
    await currentMember(tx,data.clubId,user.id,true);
    const task=await tx.clubTask.findFirst({where:{id:data.taskId,clubId:data.clubId},include:{assignments:{select:{memberId:true}}}});
    if(!task || task.status === "DRAFT" || task.status === "DONE")throw new Error("Choose an open assigned task.");
    const recipients=(await recipientsFor(tx,data.clubId,data.audience)).filter(({member})=>!task.assignments.some(a=>a.memberId === member.id));
    assertRecipientPreview(recipients,data.expectedRecipients);
    if(!recipients.length)throw new Error("These members already have this task.");
    const updated=await tx.clubTask.updateMany({where:{id:task.id,clubId:data.clubId,revision:data.revision},data:{revision:{increment:1}}});
    if(!updated.count)throw new Error("This task changed. Refresh before assigning.");
    await tx.taskAssignment.createMany({data:recipients.map(({member,groupLabel})=>({taskId:task.id,memberId:member.id,userId:member.user.id,groupLabel}))});
    await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,action:"club.task.add-recipients",targetId:task.id}});
    return {success:true};
  });
}
export async function bulkApproveTaskSubmissions(input: z.input<typeof bulkReviewSchema>) {
  const data=bulkReviewSchema.parse(input);
  const {user}=await requireClubPermission(data.clubId,["tasks.manage"]);
  return prisma.$transaction(async tx=>{
    await currentMember(tx,data.clubId,user.id,true);
    if(new Set(data.assignments.map(a=>a.id)).size !== data.assignments.length)throw new Error("Choose each submission once.");
    for(const assignment of data.assignments){
      const result=await tx.taskAssignment.updateMany({where:{id:assignment.id,revision:assignment.revision,task:{clubId:data.clubId,kind:"TASK"},submittedAt:{not:null},reviewedAt:null,revisionRequestedAt:null},data:{reviewedAt:new Date(),reviewedBy:user.id,revision:{increment:1}}});
      if(!result.count)throw new Error("A submission changed or is unavailable. Refresh before approving.");
      await tx.auditLog.create({data:{actorId:user.id,clubId:data.clubId,action:"club.task.review",targetId:assignment.id}});
    }
    return {success:true};
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
    await lockOperationalClub(tx, data.clubId);
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
        revisionRequestedAt: null,
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
  requestChanges?: boolean;
}) {
  const data = reviewTaskSchema.parse(input);
  await requireAuth();
  const assignment = await prisma.taskAssignment.findUnique({
    where: { id: data.assignmentId },
    select: { task: { select: { clubId: true, kind: true } } },
  });
  if (!assignment) throw new Error("Assignment unavailable.");
  if (data.requestChanges && assignment.task.kind !== "TASK") throw new Error("Revision requests apply to submitted tasks.");
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
        revisionRequestedAt: data.requestChanges ? new Date() : null,
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
        action: data.requestChanges ? "club.task.request-revision" : data.reopen ? "club.task.reopen" : "club.task.review",
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
    !isActiveMembership(membership) ||
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

export async function getTaskNotifications() {
  const {user}=await requireAuth();
  const records=await prisma.taskAssignment.findMany({where:{userId:user.id,member:{userId:user.id,status:"ACTIVE",user:{disabledAt:null}},task:{kind:"TASK",status:{not:"DRAFT"}}},select:{id:true,assignedAt:true,submittedAt:true,reviewedAt:true,revisionRequestedAt:true,feedback:true,task:{select:{id:true,clubId:true,title:true,kind:true,status:true,dueAt:true,club:{select:{name:true,color:true,logoUrl:true}}}}},orderBy:{assignedAt:"desc"},take:100});
  return taskNotifications(records);
}
