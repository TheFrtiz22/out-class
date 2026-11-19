import { useQueries } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { addDays, easternDateKey, easternShortDateTime, easternTime } from "~/lib/eastern";
import type { ClubTask, Membership, TaskAssignment, TaskWorkspace } from "~/lib/types";

/**
 * How the web's member task list reads a task (components/club-tasks.tsx, lib/tasks.ts
 * `taskState`). Display only: which tasks exist, who they are assigned to and whether a
 * submission is accepted are the server's (`tasks.workspace`, `tasks.submit`).
 */
export type TaskFilter = "open" | "due" | "overdue" | "submitted" | "completed" | "all";
export const taskFilters: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Active" }, { value: "due", label: "Due" }, { value: "overdue", label: "Overdue" },
  { value: "submitted", label: "Submitted" }, { value: "completed", label: "Completed" }, { value: "all", label: "All tasks" },
];

export function taskState(task: ClubTask, assignment: TaskAssignment, now = Date.now()): string {
  if (assignment.revisionRequestedAt) return "Revisions requested";
  if (assignment.reviewedAt) return "Reviewed";
  if (assignment.submittedAt) return task.dueAt && +new Date(assignment.submittedAt) > +new Date(task.dueAt) ? "Submitted late" : "Submitted";
  return task.dueAt && +new Date(task.dueAt) < now ? "Overdue" : "Assigned";
}
export const statusLabel = (task: ClubTask, own: TaskAssignment, now = Date.now()) => (task.status === "DONE" ? "Closed" : taskState(task, own, now));
export const isSubmitted = (own: TaskAssignment) => !own.revisionRequestedAt && !!(own.submittedAt || own.reviewedAt);
export const isMissing = (task: ClubTask, own: TaskAssignment, now = Date.now()) => task.status !== "DONE" && !own.reviewedAt && (!own.submittedAt || !!own.revisionRequestedAt) && !!task.dueAt && +new Date(task.dueAt) < now;
export const isClosed = (task: ClubTask, own: TaskAssignment) => !!own.reviewedAt || task.status === "DONE";

export function matchesFilter(task: ClubTask, own: TaskAssignment, filter: TaskFilter, now = Date.now()): boolean {
  const outstanding = task.status !== "DONE" && !own.reviewedAt && (!own.submittedAt || !!own.revisionRequestedAt);
  if (filter === "all") return true;
  if (filter === "completed") return task.status === "DONE" || !!own.reviewedAt;
  if (task.kind !== "TASK") return false;
  return (filter === "submitted" && isSubmitted(own)) || (filter === "overdue" && isMissing(task, own, now)) || (filter === "due" && outstanding && !isMissing(task, own, now)) || (filter === "open" && outstanding);
}

export const taskDate = (value: string | null) => (value ? easternShortDateTime(value) : "No due date");
export function relativeDue(value: string | null, now = Date.now()): string {
  if (!value) return "No due date";
  const today = easternDateKey(now), due = easternDateKey(value);
  const tomorrow = addDays(today, 1);
  return due === today ? `Today ${easternTime(value)}` : due === tomorrow ? `Tomorrow ${easternTime(value)}` : taskDate(value);
}
export const requirementsLabel = (task: ClubTask) => task.kind === "PROJECT" ? "Project"
  : task.requirements?.length ? task.requirements.map(type => ({ TEXT: "Written response", LINK: "Link", FILE: "File upload" } as Record<string, string>)[type] ?? type).join(" + ") : "Written response, link, or file";

/** A submission link as lib/tasks.ts `safeTaskLink` accepts it ("" for none), completing a missing https://; null when unusable. */
export function taskLink(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  const address = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, "")}`;
  try {
    const url = new URL(address);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && url.hostname.includes(".") && address.length <= 2000 ? address : null;
  } catch { return null; }
}

export type TaskResource = { label: string; url: string };
export function taskResources(task: ClubTask): TaskResource[] {
  if (!Array.isArray(task.resources)) return [];
  return task.resources.filter((item): item is TaskResource => !!item && typeof item === "object" && typeof (item as TaskResource).label === "string" && /^https?:\/\//i.test(String((item as TaskResource).url)));
}

/** The signed-in member's own tasks in a workspace (never drafts), with their assignment. */
export function ownTasks(workspace: TaskWorkspace | undefined): { task: ClubTask; own: TaskAssignment }[] {
  if (!workspace) return [];
  return workspace.tasks.filter(task => task.status !== "DRAFT").flatMap(task => {
    const own = task.assignments.find(assignment => assignment.memberId === workspace.memberId);
    return own ? [{ task, own }] : [];
  });
}

export const workspaceKey = (clubId: string) => ["tasks.workspace", { clubId }] as const;
/** One `tasks.workspace` read per club the person belongs to, as the web's "Your tasks across clubs". */
export function useTaskWorkspaces(memberships: Membership[]) {
  return useQueries({
    queries: memberships.map(membership => ({
      queryKey: workspaceKey(membership.clubId),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get<TaskWorkspace>("tasks.workspace", { clubId: membership.clubId }, { signal }),
    })),
  });
}
