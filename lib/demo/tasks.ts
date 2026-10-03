import { demoStore } from "./store";
import {
  taskInputSchema,
  taskAudienceSchema,
  resolveTaskRecipients,
  assertRecipientPreview,
  reviewTaskSchema,
  bulkTaskSchema,
  bulkReviewSchema,
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
        project: t.projectId ? s.tasks.filter(project=>project.id===t.projectId&&project.clubId===clubId&&project.kind==="PROJECT").map(project=>({id:project.id,title:project.title}))[0]??null : null,
        assignments: t.assignments.filter(
          (a) => manage || a.memberId === member.id,
        ).map(a => ({ ...a, member: members.find(m => m.id === a.memberId)! })),
      })),
  });
}
function recipients(clubId: string, audience: ReturnType<typeof taskAudienceSchema.parse>) {
  const workspace = getTaskWorkspace(clubId);
  if ([...audience.members,...audience.excludeMembers].some(id=>!workspace.members.some(member=>member.id===id))) throw new Error("Member unavailable.");
  const excludedTasks=workspace.tasks.filter(task=>audience.excludeTasks.includes(task.id));
  if(excludedTasks.length !== new Set(audience.excludeTasks).size)throw new Error("Choose exclusion tasks in this club.");
  return resolveTaskRecipients(workspace.members,audience,excludedTasks.flatMap(task=>task.assignments.flatMap(a=>a.memberId?[a.memberId]:[])));
}
export function previewTaskAudience(input: {clubId:string;audience:TaskInput["audience"]}) {
  access(input.clubId,true);
  return structuredClone(recipients(input.clubId,taskAudienceSchema.parse(input.audience)));
}
export function saveTask(input: TaskInput) {
  const data=taskInputSchema.parse(input);access(data.clubId,true);
  return demoStore.mutate(s=>{
    const existing=s.tasks.find(task=>task.id===data.id && task.clubId===data.clubId);
    if(data.id&&!existing)throw new Error("Task unavailable.");
    if(data.projectId && (data.projectId===data.id || data.kind!=="TASK" || !s.tasks.some(task=>task.id===data.projectId && task.clubId===data.clubId && task.kind==="PROJECT")))throw new Error("Choose a project in this club.");
    if(existing && (existing.revision!==data.revision || existing.kind!==data.kind))throw new Error("Task changed. Refresh before saving.");
    if(existing && existing.status!=="DRAFT" && data.status==="DRAFT")throw new Error("An assigned task cannot become a draft.");
    if(existing && existing.status!=="DRAFT" && JSON.stringify(taskAudienceSchema.parse(existing.audience))!==JSON.stringify(data.audience))throw new Error("Audience is fixed after assignment.");
    const assigning=data.status!=="DRAFT" && (!existing || existing.status==="DRAFT");
    const selected=assigning?recipients(data.clubId,data.audience):[];
    if(assigning){if(!selected.length)throw new Error("Choose an audience with current members.");assertRecipientPreview(selected,data.expectedRecipients)}
    const {expectedRecipients,...fields}=data;
    if(existing){Object.assign(existing,fields,{dueAt:data.dueAt?new Date(data.dueAt):null,revision:data.revision+1});if(assigning)existing.assignments=selected.map(({member,groupLabel})=>newAssignment(existing.id,member,groupLabel));return{id:existing.id}}
    const id=crypto.randomUUID();s.tasks.push({...fields,id,assigneeId:null,createdAt:new Date(),dueAt:data.dueAt?new Date(data.dueAt):null,assignments:selected.map(({member,groupLabel})=>newAssignment(id,member,groupLabel))});return{id};
  });
}
function newAssignment(taskId:string,member:ReturnType<typeof getTaskWorkspace>["members"][number],groupLabel:string|null) {
  return {id:crypto.randomUUID(),taskId,memberId:member.id,userId:member.user.id,member,groupLabel,assignedAt:new Date(),viewedAt:null,text:"",link:"",submittedAt:null,reviewedAt:null,reviewedBy:null,revisionRequestedAt:null,feedback:"",revision:0,files:[]};
}
export function bulkUpdateTasks(input: Parameters<typeof bulkTaskSchema.parse>[0]) {
  const data=bulkTaskSchema.parse(input);access(data.clubId,true);
  return demoStore.mutate(s=>{
    if(new Set(data.tasks.map(task=>task.id)).size!==data.tasks.length)throw new Error("Choose each task once.");
    for(const item of data.tasks){const task=s.tasks.find(task=>task.id===item.id&&task.clubId===data.clubId);if(!task||task.revision!==item.revision||task.status==="DRAFT")throw new Error("A task changed or is unavailable.");Object.assign(task,data.action==="CLOSE"?{status:"DONE"}:{dueAt:data.dueAt?new Date(data.dueAt):null});task.revision++}return{success:true};
  });
}
export function addTaskRecipients(input:{clubId:string;taskId:string;revision:number;audience:TaskInput["audience"];expectedRecipients:string[]}) {
  access(input.clubId,true);
  return demoStore.mutate(s=>{
    const task=s.tasks.find(task=>task.id===input.taskId&&task.clubId===input.clubId);
    if(!task||task.revision!==input.revision||["DRAFT","DONE"].includes(task.status))throw new Error("Choose an unchanged open task.");
    const selected=recipients(input.clubId,taskAudienceSchema.parse(input.audience)).filter(({member})=>!task.assignments.some(a=>a.memberId===member.id));
    assertRecipientPreview(selected,input.expectedRecipients);if(!selected.length)throw new Error("These members already have this task.");
    task.assignments.push(...selected.map(({member,groupLabel})=>newAssignment(task.id,member,groupLabel)));task.revision++;return{success:true};
  });
}
export function bulkApproveTaskSubmissions(input:Parameters<typeof bulkReviewSchema.parse>[0]) {
  const data=bulkReviewSchema.parse(input);access(data.clubId,true);
  return demoStore.mutate(()=>{
    if(new Set(data.assignments.map(a=>a.id)).size!==data.assignments.length)throw new Error("Choose each submission once.");
    for(const item of data.assignments){const {task,a}=assignment(item.id,true);if(task.clubId!==data.clubId||task.kind!=="TASK"||a.revision!==item.revision||!a.submittedAt||a.reviewedAt||a.revisionRequestedAt)throw new Error("A submission changed or is unavailable.");Object.assign(a,{reviewedAt:new Date(),reviewedBy:demoStore.get().students[0].id,revision:a.revision+1})}return{success:true};
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
      revisionRequestedAt: null,
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
  requestChanges?: boolean;
}) {
  input = reviewTaskSchema.parse(input);
  return demoStore.mutate(() => {
    const { task, a } = assignment(input.assignmentId, true);
    if (
      a.revision !== input.revision ||
      (!a.submittedAt && task.kind === "TASK")
    )
      throw new Error("Submission changed or not submitted.");
    if(input.requestChanges && task.kind!=="TASK")throw new Error("Revision requests apply to submitted tasks.");
    Object.assign(a, {
      revisionRequestedAt: input.requestChanges ? new Date() : null,
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
