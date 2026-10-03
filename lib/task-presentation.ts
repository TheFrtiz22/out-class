import type { getTaskWorkspace } from "@/actions/tasks"
import { taskState, taskAudienceSchema, type TaskAudience } from "@/lib/tasks"
export type TaskWorkspace = Awaited<ReturnType<typeof getTaskWorkspace>>
export type ClubTask = TaskWorkspace["tasks"][number]
export type TaskAssignment = ClubTask["assignments"][number]
export type TaskMember = TaskWorkspace["members"][number]
export type TaskRun = (fn: () => Promise<unknown>) => Promise<boolean>
export type ReviewEntry = { task: ClubTask; assignment: TaskAssignment }
export function taskAudienceMode(audience:TaskAudience) {
  if(audience.random)return "random"
  if(audience.everyone)return "everyone"
  if(audience.match==="ALL"||audience.excludeMembers.length||audience.excludeGroups.length||audience.excludeTasks.length)return "advanced"
  const dimensions=[{id:"members",selected:audience.members.length},{id:"years",selected:audience.years.length},{id:"groups",selected:audience.groups.length+audience.cohorts.length},{id:"roles",selected:audience.roles.length}].filter(dimension=>dimension.selected)
  return dimensions.length===1?dimensions[0].id:"advanced"
}
export function taskMemberName(member: TaskMember) { const profile=member.user.studentProfile; return profile ? `${profile.firstName} ${profile.lastName}` : member.user.email }
export const taskRoleLabels: Record<string,string> = { PRESIDENT:"President", RECRUITMENT_LEAD:"Recruitment lead", GENERAL_MEMBER:"General member" }
export function taskYearLabel(year: number, now=Date.now()) {
  const date=new Date(now),academicYear=date.getFullYear()-(date.getMonth()<7?1:0),level=academicYear+5-year
  return level>=1 && level<=4 ? `${["First","Second","Third","Fourth"][level-1]} year · ${year}` : `Class of ${year}`
}
export function taskDate(value: Date|string|null) { return value ? new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "No due date" }
export function taskLocalDate(value: Date|string|null) { if(!value)return ""; const date=new Date(value);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16) }
export function needsTaskReview(assignment: Pick<TaskAssignment,"submittedAt"|"reviewedAt"|"revisionRequestedAt">) { return !!assignment.submittedAt && !assignment.reviewedAt && !assignment.revisionRequestedAt }
export function taskCounts(task: ClubTask, now=Date.now()) {
  const assigned=task.assignments.length,reviewed=task.assignments.filter(a=>a.reviewedAt).length,submitted=task.assignments.filter(a=>a.submittedAt&&!a.revisionRequestedAt).length
  const revisions=task.assignments.filter(a=>a.revisionRequestedAt).length
  const overdue=task.status === "DONE" ? 0 : task.assignments.filter(a=>!a.reviewedAt && (!a.submittedAt || a.revisionRequestedAt) && task.dueAt && +new Date(task.dueAt)<now).length
  return {assigned,reviewed,submitted,revisions,overdue,pending:task.kind==="PROJECT"?assigned-reviewed:assigned-submitted,needsReview:task.kind === "TASK" ? task.assignments.filter(needsTaskReview).length : 0}
}
export function taskReviewQueue(tasks: readonly ClubTask[]) {
  return tasks.filter(task=>task.kind === "TASK").flatMap(task=>task.assignments.filter(needsTaskReview).map(assignment=>({task,assignment}))).sort((a,b)=>+new Date(a.assignment.submittedAt!)-+new Date(b.assignment.submittedAt!))
}
export function taskManagerSummary(tasks: readonly ClubTask[],now=Date.now()) {
  const work=tasks.filter(task=>task.kind === "TASK" && task.status !== "DRAFT")
  return {needsReview:taskReviewQueue(work).length,overdue:work.reduce((sum,task)=>sum+taskCounts(task,now).overdue,0),dueThisWeek:work.filter(task=>task.status!=="DONE" && task.dueAt && +new Date(task.dueAt)>=now && +new Date(task.dueAt)<now+7*86400000 && taskCounts(task,now).reviewed<task.assignments.length).length,completed:work.reduce((sum,task)=>sum+taskCounts(task,now).reviewed,0)}
}
export function taskAudienceLabel(task: ClubTask, now=Date.now()) {
  const audience=taskAudienceSchema.parse(task.audience)
  const parts=[...audience.years.map(year=>taskYearLabel(year,now)),...audience.groups,...audience.cohorts,...audience.roles.map(role=>taskRoleLabels[role]),...(audience.members.length?["Selected members"]:[])]
  return audience.random ? audience.random.groups ? `Random groups · ${audience.random.groups} groups` : "Random selection" : audience.everyone ? "Everyone at assignment" : parts.join(audience.match === "ALL" ? " + " : " or ") || "Assigned members"
}
export function memberTaskCounts(tasks: readonly ClubTask[],memberId:string,now=Date.now()) {
  const entries=tasks.filter(task=>task.kind==="TASK" && task.status!=="DRAFT").flatMap(task=>task.assignments.filter(a=>(a.memberId===memberId || !a.memberId && a.member.id===memberId)).map(assignment=>({task,assignment})))
  return {entries,assigned:entries.length,completed:entries.filter(({assignment})=>assignment.reviewedAt).length,awaiting:entries.filter(({assignment})=>needsTaskReview(assignment)).length,overdue:entries.filter(({task,assignment})=>task.status!=="DONE" && (taskState(task,assignment,now)==="Overdue" || assignment.revisionRequestedAt && task.dueAt && +new Date(task.dueAt)<now)).length}
}
