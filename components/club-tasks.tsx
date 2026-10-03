"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CalendarClock, FilePenLine, FileText, Link2, UploadCloud, CheckCircle2 } from "lucide-react"
import "@/components/tasks.css"
import { TaskManagerWorkspace } from "@/components/tasks/task-manager-workspace"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { taskInputSchema, taskState } from "@/lib/tasks"
import { taskDate, type TaskWorkspace as Workspace, type ClubTask as Task, type TaskAssignment as Assignment, type TaskRun as Run } from "@/lib/task-presentation"
import { getTaskWorkspace, viewTask, submitTask, uploadTaskFile, downloadTaskFile } from "@/lib/workspace-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/product/page-header"
const selectClass="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
const dateLabel=taskDate
function relativeDue(value:Date|string|null,now:number) { if(!value)return "No due date";const due=new Date(value),today=new Date(now),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);const time=due.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return due.toDateString()===today.toDateString()?`Today ${time}`:due.toDateString()===tomorrow.toDateString()?`Tomorrow ${time}`:taskDate(value) }
function isMissing(task:Task,assignment:Assignment,now:number){return task.status!=="DONE"&&!assignment.reviewedAt&&(!assignment.submittedAt||!!assignment.revisionRequestedAt)&&!!task.dueAt&&+new Date(task.dueAt)<now}
function resources(task:Task){return taskInputSchema.shape.resources.safeParse(task.resources).data??[]}
export function ClubTasks({clubId,embedded=false,initialScope="team",personalOnly=false}:{clubId:string;embedded?:boolean;personalOnly?:boolean;initialScope?:string}) {
  const {user,loading}=useAuth(),demo=useDemoMode(),membership=user?.memberships.find(member=>member.clubId===clubId)
  const [workspaceData,setWorkspace]=useState<Workspace|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[loaded,setLoaded]=useState(false),[scope,setScope]=useState(initialScope),[filter,setFilter]=useState("open"),[query,setQuery]=useState(""),[activeId,setActive]=useState<string|null>(null),[dirty,setDirty]=useState(false)
  const taskTrigger=useRef<HTMLElement|null>(null),consumedFocus=useRef<string|null>(null),focusedTask=useSearchParams().get("taskId"),now=Date.now()
  const workspace=workspaceData?.clubId===clubId?workspaceData:null,manager=!personalOnly&&!!workspace?.manage&&scope==="team",active=workspace?.tasks.find(task=>task.id===activeId)
  useEffect(()=>{if(!demo.ready||loading)return;let current=true;setError("");setLoaded(false);getTaskWorkspace(clubId).then(data=>{if(current)setWorkspace(data)}).catch(error=>{if(current){setWorkspace(null);setError(error instanceof Error?error.message:"Could not load tasks.")}}).finally(()=>{if(current)setLoaded(true)});return()=>{current=false}},[clubId,refresh,demo.ready,demo.isDemoEnabled,loading])
  useEffect(()=>{if(!dirty&&!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty,busy])
  useEffect(()=>{if(manager||!focusedTask||focusedTask===consumedFocus.current||!workspace)return;const task=workspace.tasks.find(task=>task.id===focusedTask),own=task?.assignments.find(assignment=>assignment.memberId===workspace.memberId);if(own){consumedFocus.current=focusedTask;setActive(task!.id);if(!own.viewedAt)void viewTask(own.id).catch(()=>{})}},[focusedTask,workspace,manager])
  async function run(fn:()=>Promise<unknown>){setBusy(true);setError("");try{await fn();setDirty(false);try{setWorkspace(await getTaskWorkspace(clubId))}catch{setError("Your changes were saved, but the updated list could not load. Refresh tasks to see them.")}window.dispatchEvent?.(new Event("outclass:tasks-changed"));return true}catch(error){setError(error instanceof Error?error.message:"Could not save. Please try again.");return false}finally{setBusy(false)}}
  function closeTask(){if(busy||document.querySelector('[data-task-uploading="true"]'))return;if(dirty&&!window.confirm("Close task? Unsaved changes will be lost."))return;setActive(null);setDirty(false)}
  function open(task:Task,event?:React.MouseEvent<HTMLElement>){if(dirty&&!window.confirm("Open another task? Unsaved changes will be lost."))return;taskTrigger.current=event?.currentTarget??document.activeElement as HTMLElement;setActive(task.id);setDirty(false);const own=task.assignments.find(assignment=>assignment.memberId===workspace?.memberId);if(own&&!own.viewedAt)void viewTask(own.id).catch(()=>{})}
  const personal=workspace?.tasks.filter(task=>task.status!=="DRAFT"&&task.assignments.some(assignment=>assignment.memberId===workspace.memberId))??[]
  const counts=personal.filter(task=>task.kind==="TASK").reduce((totals,task)=>{const own=task.assignments.find(assignment=>assignment.memberId===workspace!.memberId)!;if(!own.revisionRequestedAt&&(own.submittedAt||own.reviewedAt))totals.submitted++;else if(task.status!=="DONE"){if(isMissing(task,own,now))totals.missing++;else totals.due++}return totals},{due:0,missing:0,submitted:0})
  const tasks=personal.filter(task=>`${task.title} ${task.description}`.toLowerCase().includes(query.toLowerCase())).filter(task=>{
    const own=task.assignments.find(assignment=>assignment.memberId===workspace!.memberId)!,submitted=!own.revisionRequestedAt&&!!(own.submittedAt||own.reviewedAt),outstanding=task.status!=="DONE"&&!own.reviewedAt&&(!own.submittedAt||own.revisionRequestedAt)
    return filter==="all"||filter==="projects"&&task.kind==="PROJECT"||filter==="completed"&&(task.status==="DONE"||own.reviewedAt)||task.kind==="TASK"&&(filter==="submitted"&&submitted||filter==="overdue"&&isMissing(task,own,now)||filter==="due"&&outstanding&&!isMissing(task,own,now)||filter==="open"&&outstanding)
  })
  if(manager&&workspace)return <div>{!embedded&&<PageHeader eyebrow={membership?.club.name??"Club workspace"} title="Tasks"/>}{demo.isDemoEnabled&&<p className="mb-4 text-xs text-muted-foreground">Fictional demo work · files stay on this device.</p>}<TaskManagerWorkspace workspace={workspace} run={run} busy={busy} error={error} onRefresh={()=>setRefresh(value=>value+1)} onPersonal={()=>{setScope("mine");setFilter("open")}} onDirty={setDirty}/></div>
  return <div className="oc-personal-tasks space-y-7" data-unsaved={dirty} data-saving={busy}>
    {!embedded&&<><nav aria-label="Club workspace" className="flex flex-wrap gap-4 text-sm"><Link className="underline" href={`/club/${clubId}/workspace`}>Club workspace</Link><Link className="underline" href={`/club/${clubId}`}>Club profile</Link></nav><PageHeader eyebrow={membership?.club.name??"Your club"} title="Tasks" description="Your assignments, next steps, and submitted work."/></>}
    {demo.isDemoEnabled&&<p className="text-xs text-muted-foreground">Fictional demo work. File uploads are disabled in Demo Mode.</p>}
    {error&&<div role="alert" className="oc-task-error"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={()=>setRefresh(value=>value+1)}>Refresh tasks</Button></div>}
    {!loaded?<p role="status">Loading club work…</p>:workspace&&<>
      <div className="oc-task-totals" aria-label="Your task totals">{[{label:"Due",key:"due",filter:"due"},{label:"Missing",key:"missing",filter:"overdue"},{label:"Submitted",key:"submitted",filter:"submitted"}].map(item=><button key={item.key} type="button" className={`oc-task-total oc-task-${item.key}`} aria-pressed={filter===item.filter} onClick={()=>{setFilter(item.filter);setQuery("")}}><strong>{counts[item.key as keyof typeof counts]}</strong><span>{item.label}</span></button>)}</div>
      <div className="flex flex-wrap items-end gap-4">{!personalOnly&&workspace.manage&&<div role="group" aria-label="Task workspace" className="flex gap-1 rounded-md border bg-card p-1"><Button variant="secondary" aria-pressed>My Tasks</Button><Button variant="ghost" onClick={()=>{setScope("team");setFilter("open")}}>Manage</Button></div>}<label className="text-sm">Show<select className={selectClass} value={filter} onChange={event=>setFilter(event.target.value)}><option value="open">Due & active</option><option value="due">Due</option><option value="submitted">Submitted</option><option value="overdue">Missing</option><option value="completed">Completed / reviewed</option><option value="projects">Projects</option><option value="all">All work</option></select></label><label className="min-w-0 w-full text-sm sm:flex-1 sm:w-auto">Search<Input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a task or project"/></label></div>
      {!tasks.length&&<div className="py-8"><h2 className="oc-section-heading">{query||filter!=="open"?"No matching work":"You're up to date"}</h2><p className="mt-2 text-sm text-muted-foreground">Assigned club work will appear here. Choose All work to see earlier submissions.</p></div>}
      <ul className="oc-task-list">{tasks.map(task=>{const own=task.assignments.find(assignment=>assignment.memberId===workspace.memberId)!,status=task.status==="DONE"?"Closed":taskState(task,own,now),tone=!own.revisionRequestedAt&&(own.submittedAt||own.reviewedAt)?"submitted":isMissing(task,own,now)?"missing":"due";return <li key={task.id}><button type="button" className={`oc-task-row oc-task-${tone}`} onClick={event=>open(task,event)}><span className="oc-task-icon"><FilePenLine aria-hidden="true"/></span><span className="oc-task-row-copy"><strong>{task.title}</strong><span>{membership?.club.name??"Your club"}{task.projectId?` · ${task.project?.title??workspace.tasks.find(project=>project.id===task.projectId)?.title??"Related project"}`:""}{own.groupLabel?` · ${own.groupLabel}`:""}</span><small>{task.kind==="PROJECT"?"Project":task.requirements?.length?task.requirements.map(type=>({TEXT:"Written response",LINK:"Link",FILE:"File upload"})[type as "TEXT"]).join(" + "):"Written response, link, or file"} · {status==="Overdue"?"Missing":status}</small></span><span className="oc-task-deadline"><CalendarClock aria-hidden="true"/>{relativeDue(task.dueAt,now)}</span></button></li>})}</ul>
      <Sheet open={!!active} onOpenChange={open=>{if(!open)closeTask()}}><SheetContent className="oc-workspace-drawer oc-task-drawer w-full overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={event=>{event.preventDefault();if(taskTrigger.current?.isConnected)taskTrigger.current.focus();else document.getElementById("workspace-content")?.focus()}}><div className="oc-task-detail-icon"><FilePenLine aria-hidden="true"/></div><SheetTitle className="oc-task-detail-title">{active?.title||"Task details"}</SheetTitle><SheetDescription>{membership?.club.name??"Your club"} · {active?.kind==="PROJECT"?"Project":"Assignment"}</SheetDescription>{active&&<div className="oc-task-detail-meta"><span><CalendarClock size={17}/>Due {relativeDue(active.dueAt,now)}</span><span>{taskState(active,active.assignments.find(assignment=>assignment.memberId===workspace.memberId)!,now)}</span></div>}{error&&<p role="alert" className="oc-task-error">{error}</p>}{active&&<div onChangeCapture={event=>{if((event.target as HTMLElement).closest("form"))setDirty(true)}} onClickCapture={event=>{if((event.target as HTMLElement).closest("[data-task-edit]"))setDirty(true)}}><TaskDetail key={`${active.id}-${active.revision}`} task={active} workspace={workspace} manager={false} run={run} busy={busy} onOpen={open}/></div>}</SheetContent></Sheet>
    </>}
  </div>
}
function TaskDetail({task,workspace,run,busy,onOpen}:{task:Task;workspace:Workspace;manager:false;run:Run;busy:boolean;onOpen:(task:Task)=>void}) {
  const own=task.assignments.find(assignment=>assignment.memberId===workspace.memberId)
  return <section className="space-y-5 py-5">{task.projectId&&<p className="text-sm text-muted-foreground">Project · {task.project?.title??workspace.tasks.find(project=>project.id===task.projectId)?.title??"Related project"}</p>}{own?.groupLabel&&<p className="text-sm font-medium">Assigned group · {own.groupLabel}</p>}<h3 className="oc-card-heading">Instructions</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{task.description||"No additional instructions."}</p>{resources(task).length>0&&<ul aria-label="Task resources" className="space-y-2 rounded-xl border p-4 text-sm">{resources(task).map((resource,index)=><li key={index}><a className="break-words underline" href={resource.url} target="_blank" rel="noreferrer">{resource.label} ↗</a></li>)}</ul>}{own&&task.kind==="TASK"&&<Submission key={`${own.id}-${own.revision}`} task={task} assignment={own} run={run} busy={busy}/>} {task.kind==="PROJECT"&&<div><h3 className="oc-card-heading">Related tasks</h3><ul className="mt-3 space-y-2">{workspace.tasks.filter(child=>child.projectId===task.id).map(child=><li key={child.id}><Button variant="ghost" onClick={()=>onOpen(child)}>{child.title}</Button><span className="text-xs text-muted-foreground">Due {taskDate(child.dueAt)}</span></li>)}</ul></div>}</section>
}
function Submission({
  task,
  assignment: a,
  run,
  busy,
}: {
  task: Task;
  assignment: Assignment;
  run: Run;
  busy: boolean;
}) {
  const demo = useDemoMode(),
    [files, setFiles] = useState(a.files),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const closed = !!a.reviewedAt || task.status === "DONE";
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      data-task-uploading={uploading}
      data-saving={uploading || busy}
      className="oc-task-submission max-w-3xl space-y-5 rounded-xl border p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSubmitted(false);
        const success = await run(() =>
          submitTask({
            assignmentId: a.id,
            revision: a.revision,
            text: String(data.get("text") || ""),
            link: String(data.get("link") || ""),
            fileIds: files.map((f) => f.id),
          }),
        );
        if (success) setSubmitted(true);
      }}
    >
      <h3 className="oc-card-heading flex items-center gap-2"><FilePenLine size={20} />Your submission</h3>
      <p className="text-sm text-muted-foreground">
        {a.submittedAt
          ? `Submitted ${dateLabel(a.submittedAt)}${closed ? "" : " · You can update it until it is reviewed or the task closes."}`
          : "No submission yet. Late submissions are accepted while the task is open and are labeled late."}
      </p>
      <p className="text-xs text-muted-foreground">
        Required:{" "}
        {task.requirements.length
          ? task.requirements.map((s) => s.toLowerCase()).join(" + ")
          : "text, a link, or a file"}
        .{" "}
        {closed
          ? "This submission is closed."
          : "Responses are saved when you submit."}
      </p>
      <label className="oc-task-submission-field">
        <span><FileText size={17} />Written response <small>{task.requirements.includes("TEXT") ? "Required" : "Optional"}</small></span>
        <Textarea
          name="text"
          rows={5}
          maxLength={30000}
          disabled={closed || busy}
          required={task.requirements.includes("TEXT")}
          defaultValue={a.text}
        />
      </label>
      <label className="oc-task-submission-field">
        <span><Link2 size={17} />Website or document link <small>{task.requirements.includes("LINK") ? "Required" : "Optional"}</small></span>
        <Input
          name="link"
          type="url"
          maxLength={2000}
          disabled={closed || busy}
          required={task.requirements.includes("LINK")}
          defaultValue={a.link}
          placeholder="https://…"
        />
      </label>
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="break-all">
              {file.name} · {Math.ceil(file.size / 1024)} KB
              {a.files.some((f) => f.id === file.id) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const { url } = await downloadTaskFile(file.id);
                      window.location.assign(url);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Download failed.",
                      );
                    }
                  }}
                >
                  Download<span className="sr-only"> {file.name}</span>
                </Button>
              )}
            </span>
            {!closed && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || uploading}
                data-task-edit="true"
                onClick={() => setFiles(files.filter((f) => f.id !== file.id))}
              >
                Remove<span className="sr-only"> {file.name}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!closed && (
        <label className="oc-task-submission-field oc-task-upload">
          <span><UploadCloud size={19} />File upload <small>{task.requirements.includes("FILE") ? "Required" : "Optional"}</small></span>
          <span className="text-muted-foreground">
            — up to 5, 10 MB each; PDF, images, text, or Office documents
          </span>
          <Input
            type="file"
            multiple
            accept=".pdf,.txt,.png,.jpg,.jpeg,.docx,.pptx,.xlsx"
            disabled={
              busy || uploading || demo.isDemoEnabled || files.length >= 5
            }
            onChange={async (e) => {
              const selected = Array.from(e.target.files ?? []);
              e.target.value = "";
              setError("");
              if (selected.length + files.length > 5) {
                setError("Choose up to five files.");
                return;
              }
              setUploading(true);
              try {
                for (const file of selected) {
                  const upload = await uploadTaskFile({
                    assignmentId: a.id,
                    name: file.name,
                    size: file.size,
                    mime: file.type as "application/pdf",
                  });
                  const response = await fetch(upload.url, {
                    method: "PUT",
                    headers: { "Content-Type": file.type, "x-upsert": "false" },
                    body: file,
                  });
                  if (!response.ok)
                    throw new Error("Upload failed. Please try again.");
                  setFiles((current) => [
                    ...current,
                    { id: upload.id, name: file.name, size: file.size },
                  ]);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Upload failed.");
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {uploading && (
        <p role="status" className="text-sm">
          Uploading securely… Keep this page open.
        </p>
      )}
      {a.feedback && (
        <p className="whitespace-pre-wrap break-words text-sm">
          <strong className="flex items-center gap-2"><CheckCircle2 size={16} />{a.revisionRequestedAt ? "Revisions requested" : "Review feedback"}</strong> {a.feedback}
        </p>
      )}
      {submitted && <p role="status" className="text-sm text-emerald-700">Your submission was saved.</p>}
      {!closed && (
        <Button className="w-full sm:w-auto" disabled={busy || uploading}>
          {busy
            ? "Submitting…"
            : a.submittedAt
              ? a.revisionRequestedAt ? "Resubmit revisions" : "Update submission"
              : "Submit work"}
        </Button>
      )}
    </form>
  );
}