import { demoStore } from "./store";
import {
  taskInputSchema,
  taskAudienceSchema,
  matchesTaskAudience,
  submissionSchema,
  validateTaskSubmission,
  type TaskInput,
} from "@/lib/tasks";
function access(clubId: string, manage = false) {
  const s = demoStore.get(),
    member = s.memberships.find(
      (m) => m.clubId === clubId && m.userId === s.students[0].id,
    );
  if (!member || (manage && clubId !== s.clubs[0].id))
    throw new Error("Task access unavailable.");
  return { s, member, manage: clubId === s.clubs[0].id };
}
export function getTaskWorkspace(clubId: string) {
  const { s, member, manage } = access(clubId);
  const members = s.memberships
    .filter((m) => m.clubId === clubId)
    .map((m) => ({
      id: m.id,
      groups: m.groups,
      cohort: m.cohort,
      role: m.role,
      user: {
        id: m.userId,
        email: s.students.find((u) => u.id === m.userId)!.email,
        studentProfile: s.students.find((u) => u.id === m.userId)!.profile,
      },
    }));
  return structuredClone({
    clubId,
    manage,
    memberId: member.id,
    members: manage ? members : [],
    tasks: s.tasks
      .filter(
        (t) =>
          t.clubId === clubId &&
          (manage || t.assignments.some((a) => a.memberId === member.id)),
      )
      .map((t) => ({
        ...t,
        assignments: t.assignments.filter(
          (a) => manage || a.memberId === member.id,
        ).map(a => ({ ...a, member: members.find(m => m.id === a.memberId)! })),
      })),
  });
}
export function saveTask(input: TaskInput) {
  const data = taskInputSchema.parse(input);
  access(data.clubId, true);
  return demoStore.mutate((s) => {
    const existing = s.tasks.find(
      (t) => t.id === data.id && t.clubId === data.clubId,
    );
    if (data.id && !existing) throw new Error("Task unavailable.");
    if (
      data.projectId &&
      (data.kind !== "TASK" ||
        !s.tasks.some(
          (t) =>
            t.id === data.projectId &&
            t.clubId === data.clubId &&
            t.kind === "PROJECT",
        ))
    )
      throw new Error("Choose a project in this club.");
    if (existing) {
      if (existing.revision !== data.revision || existing.kind !== data.kind)
        throw new Error("Task changed. Refresh before saving.");
      if (
        JSON.stringify(taskAudienceSchema.parse(existing.audience)) !==
        JSON.stringify(data.audience)
      )
        throw new Error("Audience is fixed after assignment.");
      Object.assign(existing, data, {
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        revision: data.revision + 1,
      });
      return { id: existing.id };
    }
    const members = getTaskWorkspace(data.clubId).members;
    if (data.audience.members.some((id) => !members.some((m) => m.id === id)))
      throw new Error("Member unavailable.");
    const recipients = members.filter((m) =>
      matchesTaskAudience(
        { ...m, gradYear: m.user.studentProfile?.gradYear ?? null },
        data.audience,
      ),
    );
    if (!recipients.length)
      throw new Error("Choose an audience with current members.");
    const id = crypto.randomUUID();
    s.tasks.push({
      ...data,
      id,
      assigneeId: null,
      createdAt: new Date(),
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      assignments: recipients.map((member) => ({
        id: crypto.randomUUID(),
        taskId: id,
        memberId: member.id,
        userId: member.user.id,
        member,
        assignedAt: new Date(),
        viewedAt: null,
        text: "",
        link: "",
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        feedback: "",
        revision: 0,
        files: [],
      })),
    });
    return { id };
  });
}
function assignment(id: string, manage = false) {
  const s = demoStore.get(),
    task = s.tasks.find((t) => t.assignments.some((a) => a.id === id));
  if (!task) throw new Error("Assignment unavailable.");
  const { member } = access(task.clubId, manage),
    a = task.assignments.find((a) => a.id === id)!;
  if (!manage && a.memberId !== member.id)
    throw new Error("Assignment unavailable.");
  return { task, a };
}
export function viewTask(id: string) {
  return demoStore.mutate(() => {
    const { a } = assignment(id);
    a.viewedAt ??= new Date();
    return { success: true };
  });
}
export function submitTask(
  input: Parameters<typeof submissionSchema.parse>[0],
) {
  const data = submissionSchema.parse(input);
  return demoStore.mutate(() => {
    const { task, a } = assignment(data.assignmentId);
    if (
      a.revision !== data.revision ||
      a.reviewedAt ||
      task.status === "DONE" ||
      task.kind !== "TASK"
    )
      throw new Error(
        "Assignment closed or changed. Refresh before submitting.",
      );
    validateTaskSubmission(task.requirements, data);
    if (data.fileIds.length)
      throw new Error(
        "Demo uploads are unavailable. Use a fictional text or link submission.",
      );
    Object.assign(a, {
      text: data.text,
      link: data.link,
      submittedAt: new Date(),
      revision: a.revision + 1,
    });
    return { success: true };
  });
}
export function reviewTask(input: {
  assignmentId: string;
  revision: number;
  feedback: string;
  reopen: boolean;
}) {
  return demoStore.mutate(() => {
    const { task, a } = assignment(input.assignmentId, true);
    if (
      a.revision !== input.revision ||
      (!a.submittedAt && task.kind === "TASK")
    )
      throw new Error("Submission changed or not submitted.");
    Object.assign(a, {
      reviewedAt: input.reopen ? null : new Date(),
      reviewedBy: input.reopen ? null : demoStore.get().students[0].id,
      feedback: input.feedback,
      revision: a.revision + 1,
    });
    return { success: true };
  });
}
export function updateTaskMember(input: {
  clubId: string;
  memberId: string;
  groups: string[];
  cohort: string | null;
}) {
  access(input.clubId, true);
  return demoStore.mutate((s) => {
    const member = s.memberships.find(
      (m) => m.id === input.memberId && m.clubId === input.clubId,
    );
    if (!member) throw new Error("Member unavailable.");
    member.groups = [...new Set(input.groups)];
    member.cohort = input.cohort;
    return { success: true };
  });
}
