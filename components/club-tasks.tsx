"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, FilePenLine, FileText, Link2, UploadCloud, CheckCircle2 } from "lucide-react";
import "@/components/tasks.css";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission } from "@/lib/permissions";
import {
  taskAudienceSchema,
  taskInputSchema,
  taskState,
  type TaskInput,
} from "@/lib/tasks";
import {
  getTaskWorkspace,
  saveTask,
  updateTaskMember,
  viewTask,
  submitTask,
  reviewTask,
  uploadTaskFile,
  downloadTaskFile,
} from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type Workspace = Awaited<ReturnType<typeof getTaskWorkspace>>;
type Task = Workspace["tasks"][number];
type Assignment = Task["assignments"][number];
type Run = (fn: () => Promise<unknown>) => Promise<boolean>;
const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const dateLabel = (date: Date | string | null) =>
  date
    ? new Date(date).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No due date";
function relativeDue(date: Date | string | null, now: number) {
  if (!date) return "No due date";
  const due = new Date(date), today = new Date(now), tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return due.toDateString() === today.toDateString() ? `Today ${time}` : due.toDateString() === tomorrow.toDateString() ? `Tomorrow ${time}` : dateLabel(date);
}
const memberName = (m: Workspace["members"][number]) =>
  m.user.studentProfile
    ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}`
    : m.user.email;
const localDate = (date: Date | null) => {
  if (!date) return "";
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
function resources(task: Task) {
  return taskInputSchema.shape.resources.safeParse(task.resources).data ?? [];
}
export function ClubTasks({
  clubId,
  embedded = false,
  initialScope = "mine",
  personalOnly = false,
}: {
  clubId: string;
  embedded?: boolean;
  personalOnly?: boolean;
  initialScope?: string;
}) {
  const { user, loading } = useAuth(),
    demo = useDemoMode();
  const membership = user?.memberships.find((m) => m.clubId === clubId);
  const [workspaceData, setWorkspace] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [loaded, setLoaded] = useState(false),
    [scope, setScope] = useState(initialScope),
    [filter, setFilter] = useState("open"),
    [query, setQuery] = useState("");
  const now = Date.now();
  const [activeId, setActiveId] = useState<string | null>(null), [dirty, setDirty] = useState(false);
  const taskTrigger = useRef<HTMLElement | null>(null);
  function closeTask() {
    if (busy || document.querySelector('[data-task-uploading="true"]')) return;
    if (dirty && !window.confirm("Close task? Unsaved changes will be lost.")) return;
    setActiveId(null); setDirty(false);
  }
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (!demo.ready || loading) return;
    let current = true;
    setError("");
    getTaskWorkspace(clubId)
      .then((data) => {
        if (current) {
          setWorkspace(data);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (current) {
          setWorkspace(null);
          setLoaded(true);
          setError(e instanceof Error ? e.message : "Could not load tasks.");
        }
      });
    return () => {
      current = false;
    };
  }, [clubId, refresh, demo.ready, demo.isDemoEnabled, loading]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setDirty(false);
      setRefresh((n) => n + 1);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const workspace = workspaceData?.clubId === clubId ? workspaceData : null;
  const manager = !personalOnly && workspace?.manage && scope === "team";
  const active = workspace?.clubId === clubId ? workspace.tasks.find(t => t.id === activeId) : undefined;
  const personalTasks = workspace?.tasks.filter(t => t.kind === "TASK" && t.assignments.some(a => a.memberId === workspace.memberId)) ?? [];
  const counts = personalTasks.reduce((totals, t) => {
    const own = t.assignments.find(a => a.memberId === workspace!.memberId)!;
    if (own.submittedAt || own.reviewedAt) totals.submitted++;
    else if (t.status !== "DONE") {
      if (taskState(t, own, now) === "Overdue") totals.missing++;
      else totals.due++;
    }
    return totals;
  }, { due: 0, missing: 0, submitted: 0 });
  const tasks =
    workspace?.tasks.filter(
      (t) =>
        (manager ||
          t.assignments.some((a) => a.memberId === workspace.memberId)) &&
        (!query ||
          `${t.title} ${t.description}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (filter === "all" ||
          (filter === "due" && t.kind === "TASK" && t.status !== "DONE" && t.assignments.some(a => a.memberId === workspace.memberId && !a.submittedAt && !a.reviewedAt && taskState(t, a, now) !== "Overdue")) ||
          (filter === "projects" && t.kind === "PROJECT") ||
          (filter === "submitted" && t.assignments.some(a => (manager || a.memberId === workspace.memberId) && (manager ? a.submittedAt && !a.reviewedAt : (a.submittedAt || a.reviewedAt)) && (manager || t.kind === "TASK"))) ||
          (filter === "completed" &&
            (t.status === "DONE" ||
              (t.assignments.length > 0 &&
                t.assignments
                  .filter((a) => manager || a.memberId === workspace.memberId)
                  .every((a) => a.reviewedAt)))) ||
          (filter === "overdue" &&
            t.status !== "DONE" &&
            t.assignments.some(
              (a) =>
                (manager || a.memberId === workspace.memberId) &&
                taskState(t, a, now) === "Overdue" && (manager || t.kind === "TASK"),
            )) ||
          (filter === "open" &&
            t.status !== "DONE" &&
            ((manager && !t.assignments.length) ||
              t.assignments.some(
                (a) =>
                  (manager || a.memberId === workspace.memberId) &&
                  !a.reviewedAt && (manager || !a.submittedAt),
              )))),
    ) ?? [];
  return (
    <div className={`space-y-7 ${manager ? "" : "oc-personal-tasks"}`} data-unsaved={dirty} data-saving={busy}>
      {!embedded && (
        <nav
          aria-label="Club workspace"
          className="flex flex-wrap gap-x-5 gap-y-3 text-sm"
        >
          <Link
            className="underline underline-offset-4"
            href={`/club/${clubId}/workspace`}
          >
            Club workspace
          </Link>
          <Link
            className="underline underline-offset-4"
            href={`/club/${clubId}`}
          >
            Club profile
          </Link>
          <Link
            className="underline underline-offset-4"
            href={`/meetings?clubId=${clubId}`}
          >
            Meetings
          </Link>
          <span aria-current="page">Tasks</span>
        </nav>
      )}
      {!embedded && (
        <header className="space-y-2 border-b pb-6">
          <p className="text-sm text-muted-foreground">
            {membership?.club.name ?? "Club workspace"}
          </p>
          <h1 className="oc-page-title ">Semester work</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Projects, weekly assignments, and the next thing to do. Your club
            work stays here.
          </p>
        </header>
      )}
      {demo.isDemoEnabled && (
        <p className="text-sm text-muted-foreground">
          Fictional demo work, saved on this device. File uploads are disabled
          in Demo Mode.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 p-4 text-sm"
        >
          <p>{error}</p>
          <Button
            className="mt-2"
            variant="outline"
            disabled={busy}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh tasks
          </Button>
        </div>
      )}
      {!loaded ? (
        <p role="status" className="py-12 text-muted-foreground">
          Loading club work…
        </p>
      ) : (
        workspace && (
          <>
            {!manager && <div className="oc-task-totals" aria-label="Your task totals">{[{ label: "Due", key: "due", filter: "due" }, { label: "Missing", key: "missing", filter: "overdue" }, { label: "Submitted", key: "submitted", filter: "submitted" }].map(item => <button key={item.key} type="button" className={`oc-task-total oc-task-${item.key}`} aria-pressed={filter === item.filter} onClick={() => { setFilter(item.filter); setQuery("") }}><strong>{counts[item.key as keyof typeof counts]}</strong><span>{item.label}</span></button>)}</div>}
            <div className="flex flex-wrap items-end gap-4">
              {!personalOnly && workspace.manage && (
                <div role="group" aria-label="Task workspace" className="flex gap-1 rounded-md border bg-card p-1">{[{ id: "mine", label: "My Tasks" }, { id: "team", label: "Team" }].map(item => <Button key={item.id} variant={scope === item.id ? "secondary" : "ghost"} aria-pressed={scope === item.id} onClick={() => { setScope(item.id); setFilter("open") }}>{item.label}</Button>)}</div>
              )}
              <label className="text-sm">
                Show
                <select
                  className={selectClass}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="open">Due & active</option>
                  {!manager && <option value="due">Due</option>}
                  <option value="submitted">{manager ? "Submitted · awaiting review" : "Submitted"}</option>
                  <option value="overdue">{manager ? "Overdue" : "Missing"}</option>
                  <option value="completed">Completed / reviewed</option>
                  <option value="projects">Projects</option>
                  <option value="all">All work</option>
                </select>
              </label>
              <label className="w-full min-w-0 basis-full text-sm sm:flex-1 sm:basis-48">
                Search
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a task or project"
                />
              </label>
            </div>
            {manager && (
              <details className="border-y py-4">
                <summary className="cursor-pointer font-medium">
                  Create a task or project
                </summary>
                <TaskEditor
                  clubId={clubId}
                  workspace={workspace}
                  run={run}
                  busy={busy}
                />
              </details>
            )}
            {!tasks.length && (
              <div className="py-12">
                <h2 className="oc-section-heading ">
                  {query || filter !== "open"
                    ? "No matching work"
                    : "You're up to date"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {manager
                    ? "Create an assignment above, or choose another filter."
                    : "Assigned club work will appear here. Choose All work to see earlier submissions."}
                </p>
              </div>
            )}
            {!manager ? <ul className="oc-task-list">{tasks.map(task => {
              const own = task.assignments.find(a => a.memberId === workspace.memberId)!;
              const status = task.status === "DONE" ? "Closed" : taskState(task, own, now);
              const tone = own.submittedAt || own.reviewedAt ? "submitted" : status === "Overdue" ? "missing" : "due";
              return <li key={task.id}><button type="button" className={`oc-task-row oc-task-${tone}`} onClick={event => { taskTrigger.current = event.currentTarget; setActiveId(task.id); setDirty(false); if (!own.viewedAt) void viewTask(own.id).catch(() => {}) }}>
                <span className="oc-task-icon"><FilePenLine aria-hidden="true" /></span>
                <span className="oc-task-row-copy"><strong>{task.title}</strong><span>{membership?.club.name ?? "Your club"}{task.projectId ? ` · ${workspace.tasks.find(p => p.id === task.projectId)?.title ?? "Related project"}` : ""}</span><small>{task.kind === "PROJECT" ? "Project" : (task.requirements?.length ? task.requirements.map(type => ({ TEXT: "Written response", LINK: "Link", FILE: "File upload" })[type] ?? type).join(" + ") : "Written response, link, or file")}{" · "}{status === "Overdue" ? "Missing" : status}</small></span>
                <span className="oc-task-deadline"><CalendarClock aria-hidden="true" />{relativeDue(task.dueAt, now)}</span>
              </button></li>
            })}</ul> : (
            <div className="border-y">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b px-3 py-3 text-xs text-muted-foreground md:grid" aria-hidden="true"><span>Task</span><span>Assigned to</span><span>Due</span><span>Status</span></div>
              <ul className="divide-y">{tasks.map(task => { const own = task.assignments.find(a => a.memberId === workspace.memberId); const reviewed = task.assignments.filter(a => a.reviewedAt).length; const submitted = task.assignments.filter(a => a.submittedAt && !a.reviewedAt).length; return <li key={task.id}><button type="button" className="grid w-full gap-3 rounded px-3 py-5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-4" onClick={event => { taskTrigger.current = event.currentTarget; setActiveId(task.id); setDirty(false); if (own && !own.viewedAt) void viewTask(own.id).catch(() => {}) }}>
                <span className="min-w-0"><span className="block break-words text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.kind === "PROJECT" ? "Project" : "Task"}{task.projectId ? ` · ${workspace.tasks.find(p => p.id === task.projectId)?.title ?? "Related project"}` : ""}</span></span>
                <span className="break-words text-xs text-muted-foreground"><span className="md:hidden">Assigned to: </span>{manager ? task.assignments.length === 1 ? memberName(task.assignments[0].member) : `${task.assignments.length} members` : "You"}</span>
                <span className="text-xs text-muted-foreground"><span className="md:hidden">Due: </span>{dateLabel(task.dueAt)}</span>
                <span className="text-xs">{task.status === "DONE" ? "Closed" : manager ? `${reviewed}/${task.assignments.length} reviewed${submitted ? ` · ${submitted} awaiting review` : ""}` : own ? taskState(task, own) : task.status.replaceAll("_", " ")}</span>
              </button></li> })}</ul>
            </div>
            )}
            <Sheet open={!!active} onOpenChange={open => { if (!open) closeTask() }}><SheetContent className={`oc-workspace-drawer w-full overflow-y-auto sm:max-w-2xl ${manager ? "" : "oc-task-drawer"}`} onCloseAutoFocus={e => { e.preventDefault(); if (taskTrigger.current?.isConnected) taskTrigger.current.focus(); else document.getElementById("workspace-content")?.focus() }}>
              {!manager && <div className="oc-task-detail-icon"><FilePenLine aria-hidden="true" /></div>}
              <SheetTitle className={!manager ? "oc-task-detail-title" : ""}>{active?.title || "Task details"}</SheetTitle><SheetDescription>{membership?.club.name ?? "Your club"} · {active?.kind === "PROJECT" ? "Project" : "Assignment"}</SheetDescription>
              {!manager && active && <div className="oc-task-detail-meta"><span><CalendarClock size={17} />Due {relativeDue(active.dueAt, now)}</span><span>{active.assignments.find(a => a.memberId === workspace.memberId) ? taskState(active, active.assignments.find(a => a.memberId === workspace.memberId)!, now) : active.status}</span></div>}
              {error && <p role="alert" className="my-4 text-sm text-destructive">{error} Your entries remain here. Close the drawer and refresh when ready to reload.</p>}
              {active && <div onChangeCapture={event => { if ((event.target as HTMLElement).closest("form")) setDirty(true) }} onClickCapture={event => { if ((event.target as HTMLElement).closest("[data-task-edit]")) setDirty(true) }}><TaskDetail key={`${active.id}-${active.revision}`} task={active} workspace={workspace} manager={!!manager} run={run} busy={busy} /></div>}
            </SheetContent></Sheet>
            {manager && hasPermission(membership, "members.manage") && (
              <details className="border-t pt-5">
                <summary className="cursor-pointer font-medium">
                  Member groups & cohorts
                </summary>
                <p className="my-3 text-sm text-muted-foreground">
                  Members can belong to multiple groups. These labels target new
                  assignments; existing recipients stay unchanged.
                </p>
                <div className="divide-y">
                  {workspace.members.map((m) => (
                    <MemberLabels
                      key={m.id}
                      clubId={clubId}
                      member={m}
                      run={run}
                      busy={busy}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )
      )}
    </div>
  );
}
function TaskEditor({
  clubId,
  workspace,
  task,
  run,
  busy,
}: {
  clubId: string;
  workspace: Workspace;
  task?: Task;
  run: Run;
  busy: boolean;
}) {
  const [kind, setKind] = useState(task?.kind ?? "TASK"),
    [everyone, setEveryone] = useState(true),
    [created, setCreated] = useState(false);
  const audience = taskAudienceSchema.parse(task?.audience ?? {});
  const groupOptions = [
      ...new Set(workspace.members.flatMap((m) => m.groups)),
    ].sort(),
    cohorts = [
      ...new Set(
        workspace.members.flatMap((m) => (m.cohort ? [m.cohort] : [])),
      ),
    ].sort(),
    years = [
      ...new Set(
        workspace.members.flatMap((m) =>
          m.user.studentProfile ? [m.user.studentProfile.gradYear] : [],
        ),
      ),
    ].sort();
  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          data = new FormData(form);
        setCreated(false);
        const due = String(data.get("dueAt") || "");
        const input: TaskInput = {
          clubId,
          id: task?.id,
          revision: task?.revision ?? 0,
          kind: kind as "TASK" | "PROJECT",
          projectId:
            kind === "TASK"
              ? String(data.get("projectId") || "") || null
              : null,
          title: String(data.get("title")),
          description: String(data.get("description")),
          dueAt: due ? new Date(due).toISOString() : null,
          status: String(data.get("status") || "OPEN") as "OPEN",
          requirements:
            kind === "TASK"
              ? (data.getAll("requirements") as ("TEXT" | "LINK" | "FILE")[])
              : [],
          resources: String(data.get("resources") || "")
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              const [label, ...url] = line.split(" | ");
              return { label: label.trim(), url: url.join(" | ").trim() };
            }),
          audience: task
            ? audience
            : {
                everyone,
                members: data.getAll("members") as string[],
                groups: data.getAll("groups") as string[],
                cohorts: data.getAll("cohorts") as string[],
                years: data.getAll("years").map(Number),
                roles: data.getAll("roles") as (
                  "PRESIDENT" | "RECRUITMENT_LEAD" | "GENERAL_MEMBER"
                )[],
              },
        };
        if ((await run(() => saveTask(input))) && !task) {
          form.reset();
          setKind("TASK");
          setEveryone(true);
          setCreated(true);
        }
      }}
    >
      {created && (
        <p role="status" className="text-sm">
          Assignment created.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Type
          <select
            className={selectClass}
            value={kind}
            disabled={!!task}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="TASK">Task</option>
            <option value="PROJECT">Project</option>
          </select>
        </label>
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={task?.status ?? "OPEN"}
            className={selectClass}
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Closed / completed</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Title
        <Input
          name="title"
          maxLength={200}
          required
          defaultValue={task?.title}
        />
      </label>
      <label className="block text-sm">
        Description
        <Textarea
          name="description"
          maxLength={10000}
          rows={4}
          defaultValue={task?.description}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Due date & time (your local time)
          <Input
            type="datetime-local"
            name="dueAt"
            defaultValue={localDate(task?.dueAt ?? null)}
          />
        </label>
        {kind === "TASK" && (
          <label className="text-sm">
            Related project
            <select
              name="projectId"
              className={selectClass}
              defaultValue={task?.projectId ?? ""}
            >
              <option value="">Standalone task</option>
              {workspace.tasks
                .filter((t) => t.kind === "PROJECT")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      <label className="block text-sm">
        Resources{" "}
        <span className="text-muted-foreground">
          — one “Label | https://link” per line
        </span>
        <Textarea
          name="resources"
          rows={3}
          defaultValue={
            task
              ? resources(task)
                  .map((r) => `${r.label} | ${r.url}`)
                  .join("\n")
              : ""
          }
          placeholder="Research guide | https://…"
        />
      </label>
      {kind === "TASK" ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Required submission formats
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">
            Select any combination, or leave unchecked to accept text, a link,
            or a file.
          </p>
          <div className="flex flex-wrap gap-5">
            {["TEXT", "LINK", "FILE"].map((value) => (
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                key={value}
              >
                <input
                  type="checkbox"
                  name="requirements"
                  value={value}
                  defaultChecked={task?.requirements.includes(value)}
                />
                {value.toLowerCase()}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          Projects collect related tasks. Managers mark each member&#39;s project
          complete; submissions belong to individual tasks.
        </p>
      )}
      {task ? (
        <p className="text-sm text-muted-foreground">
          Audience fixed at creation · {task.assignments.length} current
          recipients. Create a new assignment to target a different audience.
        </p>
      ) : (
        <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Audience · {everyone ? "Everyone" : "Selected recipients"}</summary><fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Assign to</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={everyone}
              onChange={(e) => setEveryone(e.target.checked)}
            />
            Everyone in this club
          </label>
          <p className="text-xs text-muted-foreground">
            Anyone matching any selected group is included once. New members
            won&#39;t be added to existing assignments automatically.
          </p>
          {!everyone && (
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                {
                  name: "members",
                  label: "Individual members",
                  options: workspace.members.map((m) => ({
                    value: m.id,
                    label: memberName(m),
                  })),
                },
                {
                  name: "groups",
                  label: "Groups / teams",
                  options: groupOptions.map((g) => ({ value: g, label: g })),
                },
                {
                  name: "cohorts",
                  label: "Join semester / cohort",
                  options: cohorts.map((g) => ({ value: g, label: g })),
                },
                {
                  name: "years",
                  label: "Graduation year",
                  options: years.map((g) => ({
                    value: String(g),
                    label: String(g),
                  })),
                },
                {
                  name: "roles",
                  label: "Membership role (does not change permissions)",
                  options: [
                    { value: "PRESIDENT", label: "President" },
                    { value: "RECRUITMENT_LEAD", label: "Recruitment lead" },
                    { value: "GENERAL_MEMBER", label: "General member" },
                  ],
                },
              ].map((group) => (
                <fieldset key={group.name}>
                  <legend className="text-sm font-medium">{group.label}</legend>
                  <div className="max-h-48 overflow-y-auto">
                    {group.options.length ? (
                      group.options.map((o) => (
                        <label
                          key={o.value}
                          className="flex min-h-11 items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name={group.name}
                            value={o.value}
                          />
                          {o.label}
                        </label>
                      ))
                    ) : (
                      <p className="py-3 text-xs text-muted-foreground">
                        No labels set yet.
                      </p>
                    )}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </fieldset></details>
      )}
      <Button disabled={busy}>
        {busy ? "Saving…" : task ? "Save changes" : "Create assignment"}
      </Button>
    </form>
  );
}
function TaskDetail({
  task,
  workspace,
  manager,
  run,
  busy,
}: {
  task: Task;
  workspace: Workspace;
  manager: boolean;
  run: Run;
  busy: boolean;
}) {
  const own = task.assignments.find((a) => a.memberId === workspace.memberId),
    [progressFilter, setProgressFilter] = useState("all"),
    [memberQuery, setMemberQuery] = useState("");
  const audience = taskAudienceSchema.parse(task.audience ?? {});
  return (
    <section className="py-6">
      {task.projectId && <p className="mb-4 text-sm text-muted-foreground">Project: {workspace.tasks.find(p => p.id === task.projectId)?.title ?? "Related project"}</p>}
      {manager && <details className="border-b pb-4"><summary className="cursor-pointer text-sm font-medium">Audience & recipients · {task.assignments.length}</summary><p className="mt-3 text-xs leading-6 text-muted-foreground">Recipients were fixed when this assignment was created.</p><ul className="mt-3 space-y-2 text-sm">{audience.everyone && <li>Everyone at creation</li>}{audience.members.length > 0 && <li>Individuals: {audience.members.map(id => { const member = workspace.members.find(m => m.id === id); return member ? memberName(member) : "Former member" }).join(", ")}</li>}{audience.groups.length > 0 && <li>Groups: {audience.groups.join(", ")}</li>}{audience.cohorts.length > 0 && <li>Cohorts: {audience.cohorts.join(", ")}</li>}{audience.years.length > 0 && <li>Years: {audience.years.join(", ")}</li>}{audience.roles.length > 0 && <li>Roles: {audience.roles.map(r => r.replaceAll("_", " ").toLowerCase()).join(", ")}</li>}</ul></details>}
        <div className="mt-6 space-y-5">
          <h3 className="oc-card-heading ">Instructions</h3>
          <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-7">
            {task.description || "No additional instructions."}
          </p>
          {resources(task).length > 0 && (
            <ul aria-label="Task resources" className="space-y-2 rounded-xl border bg-slate-50 p-4 text-sm">
              {resources(task).map((r, i) => (
                <li key={i}>
                  <a
                    className="break-words underline underline-offset-4"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
          {own && task.kind === "TASK" && (
            <Submission
              key={`${own.id}-${own.revision}`}
              task={task}
              assignment={own}
              run={run}
              busy={busy}
            />
          )}
          {task.kind === "PROJECT" && (
            <div className="text-sm">
              <h3 className="oc-card-heading ">Related tasks</h3>
              <ul className="mt-2 space-y-2">
                {workspace.tasks
                  .filter((t) => t.projectId === task.id)
                  .map((t) => (
                    <li key={t.id}>
                      {t.title} · {dateLabel(t.dueAt)}
                    </li>
                  ))}
              </ul>
              {!workspace.tasks.some((t) => t.projectId === task.id) && (
                <p className="mt-2 text-muted-foreground">
                  No related tasks assigned to you yet.
                </p>
              )}
            </div>
          )}
          {manager && (
            <>
              <details className="border-t pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit assignment
                </summary>
                <TaskEditor
                  clubId={workspace.clubId}
                  workspace={workspace}
                  task={task}
                  run={run}
                  busy={busy}
                />
              </details>
              <div className="border-t pt-5">
                <h3 className="oc-card-heading ">Member progress</h3>
                <div className="my-4 flex flex-wrap gap-3">
                  <label className="text-sm">
                    Status
                    <select
                      className={selectClass}
                      value={progressFilter}
                      onChange={(e) => setProgressFilter(e.target.value)}
                    >
                      {[
                        "all",
                        "Assigned",
                        "Overdue",
                        "Submitted",
                        "Submitted late",
                        "Reviewed",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s === "all" ? "All members" : s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Member
                    <Input
                      type="search"
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder="Name or email"
                    />
                  </label>
                </div>
                <div className="divide-y">
                  {task.assignments
                    .filter(
                      (a) =>
                        (progressFilter === "all" ||
                          taskState(task, a) === progressFilter) &&
                        `${memberName(a.member)} ${a.member.user.email}`
                          .toLowerCase()
                          .includes(memberQuery.toLowerCase()),
                    )
                    .map((a) => (
                      <Review
                        key={`${a.id}-${a.revision}`}
                        task={task}
                        assignment={a}
                        run={run}
                        busy={busy}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
    </section>
  );
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
          <strong className="flex items-center gap-2"><CheckCircle2 size={16} />Review feedback</strong> {a.feedback}
        </p>
      )}
      {submitted && <p role="status" className="text-sm text-emerald-700">Your submission was saved.</p>}
      {!closed && (
        <Button className="w-full sm:w-auto" disabled={busy || uploading}>
          {busy
            ? "Submitting…"
            : a.submittedAt
              ? "Update submission"
              : "Submit work"}
        </Button>
      )}
    </form>
  );
}
function Review({
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
  const [error, setError] = useState("");
  return (
    <details className="py-4">
      <summary className="cursor-pointer text-sm">
        <span className="font-medium">{memberName(a.member)}</span>
        <span className="ml-3 text-muted-foreground">
          {taskState(task, a)}
          {a.viewedAt ? " · Viewed" : " · Not viewed"}
        </span>
      </summary>
      <div className="mt-4 space-y-3 text-sm">
        <p className="text-muted-foreground">
          Assigned {dateLabel(a.assignedAt)}
          {a.submittedAt ? ` · Submitted ${dateLabel(a.submittedAt)}` : ""}
          {a.reviewedAt ? ` · Reviewed ${dateLabel(a.reviewedAt)}` : ""}
        </p>
        <p className="whitespace-pre-wrap break-words leading-7">{a.text}</p>
        {a.link && (
          <a
            className="block break-all underline"
            href={a.link}
            target="_blank"
            rel="noreferrer"
          >
            Submitted link ↗
          </a>
        )}
        {a.files.map((f) => (
          <Button
            type="button"
            variant="outline"
            className="mr-2 max-w-full whitespace-normal break-all"
            key={f.id}
            onClick={async () => {
              setError("");
              try {
                const { url } = await downloadTaskFile(f.id);
                window.location.assign(url);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed.");
              }
            }}
          >
            {f.name}
          </Button>
        ))}
        {error && <p role="alert">{error}</p>}
        {(a.submittedAt || task.kind === "PROJECT") && (
          <form
            className="max-w-2xl space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const feedback = String(
                new FormData(e.currentTarget).get("feedback"),
              );
              await run(() =>
                reviewTask({
                  assignmentId: a.id,
                  revision: a.revision,
                  feedback,
                  reopen: !!a.reviewedAt,
                }),
              );
            }}
          >
            <label className="block">
              Feedback
              <Textarea
                name="feedback"
                defaultValue={a.feedback}
                maxLength={5000}
                rows={3}
              />
            </label>
            <Button variant="outline" disabled={busy}>
              {a.reviewedAt
                ? "Reopen for updates"
                : task.kind === "PROJECT"
                  ? "Mark project complete"
                  : "Mark reviewed / complete"}
            </Button>
          </form>
        )}
      </div>
    </details>
  );
}
function MemberLabels({
  clubId,
  member,
  run,
  busy,
}: {
  clubId: string;
  member: Workspace["members"][number];
  run: Run;
  busy: boolean;
}) {
  return (
    <form
      className="grid gap-3 py-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await run(() =>
          updateTaskMember({
            clubId,
            memberId: member.id,
            groups: String(data.get("groups"))
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
            cohort: String(data.get("cohort")).trim() || null,
          }),
        );
      }}
    >
      <p className="text-sm font-medium sm:col-span-2">{memberName(member)}</p>
      <label className="text-sm">
        Groups (comma-separated)
        <Input name="groups" defaultValue={member.groups.join(", ")} />
      </label>
      <label className="text-sm">
        Join semester / cohort
        <Input
          name="cohort"
          maxLength={80}
          defaultValue={member.cohort ?? ""}
          placeholder="e.g. Fall 2026"
        />
      </label>
      <Button variant="outline" disabled={busy} className="justify-self-start">
        Save labels<span className="sr-only"> for {memberName(member)}</span>
      </Button>
    </form>
  );
}
