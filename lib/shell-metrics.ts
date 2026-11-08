/**
 * Start counters for the shell's long-lived jobs (notification polling, communications live updates,
 * the tutorial load, search). The persistent shell must start each once per session, not once per
 * navigation; browser tests read `window.__outclassShellStarts` to prove it. No data, ids or timing.
 */
export type ShellJob = "task-poll" | "communications-live" | "tutorial" | "search"

export function countShellStart(job: ShellJob) {
  if (typeof window === "undefined") return
  const target = window as typeof window & { __outclassShellStarts?: Partial<Record<ShellJob, number>> }
  const counts = target.__outclassShellStarts ??= {}
  counts[job] = (counts[job] ?? 0) + 1
}
