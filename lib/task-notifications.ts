import type { Notification } from "@/lib/data"
export type TaskNotificationSource = { id:string; assignedAt:Date|string; submittedAt:Date|string|null; reviewedAt:Date|string|null; revisionRequestedAt:Date|string|null; feedback:string; task:{id:string;clubId:string;title:string;kind:string;status:string;dueAt:Date|string|null;club:{name:string;color:string|null;logoUrl?:string|null}} }
/** Derive a bounded, deduplicated inbox from assignment records, never a second task store. */
export function taskNotifications(records: readonly TaskNotificationSource[],now=Date.now()):Notification[] {
  return records.flatMap(record=>{
    const {task}=record;if(task.kind!=="TASK"||task.status==="DRAFT")return []
    if (record.submittedAt && !record.revisionRequestedAt && !record.reviewedAt || task.status === "DONE" && !record.reviewedAt && !record.revisionRequestedAt) return []
    const type=record.revisionRequestedAt?"revision":record.reviewedAt?"reviewed":task.status!=="DONE"&&(!record.submittedAt)&&task.dueAt&&+new Date(task.dueAt)>=now&&+new Date(task.dueAt)<now+2*86400000?"due":"assigned"
    const at=type==="revision"?record.revisionRequestedAt!:type==="reviewed"?record.reviewedAt!:type==="due"?task.dueAt!:record.assignedAt
    const title=type==="revision"?`Revisions requested: ${task.title}`:type==="reviewed"?`Submission reviewed: ${task.title}`:type==="due"?`Due soon: ${task.title}`:`New task: ${task.title}`
    const body=type==="revision"||type==="reviewed"?record.feedback||"Open the task to see its review.":type==="due"?`Due ${new Date(task.dueAt!).toLocaleString()}. Open the task to submit your work.`:"Your club has assigned this task to you. Open it for instructions and submission requirements."
    return [{id:`task-update-${record.id}-${type}-${new Date(at).toISOString()}`,taskHref:`/club/${encodeURIComponent(task.clubId)}/workspace?section=tasks&taskView=mine&taskId=${encodeURIComponent(task.id)}`,clubId:task.clubId,type:"Announcement" as const,urgent:type==="revision"||type==="due",club:task.club.name,color:task.club.color||"#142d45",logoUrl:task.club.logoUrl,logoText:task.club.name.slice(0,2),senderName:task.club.name,senderTitle:"Task update",title,preview:body,body:[body],timestamp:type==="due"?"Due soon":new Date(at).toLocaleDateString(),fullDate:new Date(at).toLocaleString(),createdAt:new Date(type==="due"?now:at).toISOString(),read:false,cta:"View task"}]
  })
}
