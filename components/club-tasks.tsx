"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
}: {
  clubId: string;
  embedded?: boolean;
  initialScope?: string;
}) {
  const { user, loading } = useAuth(),
    demo = useDemoMode();
  const membership = user?.memberships.find((m) => m.clubId === clubId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [loaded, setLoaded] = useState(false),
    [scope, setScope] = useState(initialScope),
    [filter, setFilter] = useState("open"),
    [query, setQuery] = useState("");
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
  const manager = workspace?.manage && scope === "team";
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
          (filter === "projects" && t.kind === "PROJECT") ||
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
                taskState(t, a) === "Overdue",
            )) ||
          (filter === "open" &&
            t.status !== "DONE" &&
            ((manager && !t.assignments.length) ||
              t.assignments.some(
                (a) =>
                  (manager || a.memberId === workspace.memberId) &&
                  !a.reviewedAt,
              )))),
    ) ?? [];
  return (
    <div className="space-y-7">
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
          <h1 className="font-display text-3xl sm:text-4xl">Semester work</h1>
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
            <div className="flex flex-wrap items-end gap-4">
              {workspace.manage && (
                <label className="text-sm">
                  View
                  <select
                    className={selectClass}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="mine">My assignments</option>
                    <option value="team">Manage club work</option>
                  </select>
                </label>
              )}
              <label className="text-sm">
                Show
                <select
                  className={selectClass}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="open">Upcoming & active</option>
                  <option value="overdue">Overdue</option>
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
                <h2 className="text-lg font-medium">
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
            <div className="divide-y">
              {tasks.map((task) => (
                <TaskRow
                  key={`${task.id}-${task.revision}`}
                  task={task}
                  workspace={workspace}
                  manager={!!manager}
                  run={run}
                  busy={busy}
                />
              ))}
            </div>
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
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Assign to</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={everyone}
              onChange={(e) => setEveryone(e.target.checked)}
            />
            Whole club
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
        </fieldset>
      )}
      <Button disabled={busy}>
        {busy ? "Saving…" : task ? "Save changes" : "Create assignment"}
      </Button>
    </form>
  );
}
function TaskRow({
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
  const completed = task.assignments.filter((a) => a.reviewedAt).length,
    submitted = task.assignments.filter((a) => a.submittedAt).length;
  return (
    <section className="py-6">
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && own && !own.viewedAt)
            void viewTask(own.id).catch(() => {
              /* Viewing is informational; submission remains available. */
            });
        }}
      >
        <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {task.kind === "PROJECT" ? "Project" : "Task"}
                {task.projectId &&
                  ` · ${workspace.tasks.find((p) => p.id === task.projectId)?.title ?? "Related project"}`}
              </p>
              <h2 className="mt-1 break-words text-lg font-semibold">
                {task.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Due {dateLabel(task.dueAt)}
              </p>
            </div>
            <span className="text-sm">
              {task.status === "DONE"
                ? "Closed"
                : manager
                  ? `${completed}/${task.assignments.length} reviewed${task.kind === "TASK" ? ` · ${submitted} submitted` : ""}`
                  : own
                    ? taskState(task, own)
                    : task.status.replaceAll("_", " ")}
            </span>
          </div>
          <span className="mt-3 inline-block text-xs underline underline-offset-4">
            Open details
          </span>
        </summary>
        <div className="mt-6 space-y-5">
          <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-7">
            {task.description || "No additional instructions."}
          </p>
          {resources(task).length > 0 && (
            <ul className="space-y-2 text-sm">
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
              <h3 className="font-medium">Related tasks</h3>
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
                <h3 className="font-medium">Member progress</h3>
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
      </details>
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
  return (
    <form
      className="max-w-3xl space-y-4 border-t pt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await run(() =>
          submitTask({
            assignmentId: a.id,
            revision: a.revision,
            text: String(data.get("text") || ""),
            link: String(data.get("link") || ""),
            fileIds: files.map((f) => f.id),
          }),
        );
      }}
    >
      <h3 className="font-medium">Your submission</h3>
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
      <label className="block text-sm">
        Written response
        <Textarea
          name="text"
          rows={5}
          maxLength={30000}
          disabled={closed || busy}
          required={task.requirements.includes("TEXT")}
          defaultValue={a.text}
        />
      </label>
      <label className="block text-sm">
        Link
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
                onClick={() => setFiles(files.filter((f) => f.id !== file.id))}
              >
                Remove<span className="sr-only"> {file.name}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!closed && (
        <label className="block text-sm">
          Files{" "}
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
          <strong>Manager feedback:</strong> {a.feedback}
        </p>
      )}
      {!closed && (
        <Button disabled={busy || uploading}>
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
