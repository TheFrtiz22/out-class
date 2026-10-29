"use client"
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useState } from "react"
import { getTaskWorkspace, viewTask } from "@/lib/workspace-api"
import { TaskDetail } from "@/components/club-tasks"
import { TaskReviewWorkspace } from "@/components/tasks/task-review-workspace"
import { type TaskWorkspace, taskReviewQueue } from "@/lib/task-presentation"
import { Button } from "@/components/ui/button"

export function DashboardTask({ clubId, taskId, assignmentId, review = false, onChanged, onClose }: { clubId: string; taskId: string; assignmentId?: string; review?: boolean; onChanged: () => void; onClose: () => void }) {
  const [notice, setNotice] = useState("")
  const [selectedId, setSelectedId] = useState(taskId)
  const [workspace, setWorkspace] = useState<TaskWorkspace | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    getTaskWorkspace(clubId, { taskId, assignmentId }).then(value => { if (current) { setWorkspace(value); setError(""); const own = value.tasks[0]?.assignments.find(a => a.memberId === value.memberId); if (own && !own.viewedAt) void viewTask(own.id).catch(() => {}) } }).catch(() => { if (current) { setWorkspace(null); setError("This assignment could not load. Check your access or try again.") } })
    return () => { current = false }
  }, [clubId, taskId, assignmentId, retry])
  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("")
    try { await fn(); onChanged(); try { setWorkspace(await getTaskWorkspace(clubId, { taskId, assignmentId })) } catch { setWorkspace(null); setError("Saved, but the updated assignment could not load. Retry to check its current state.") } setNotice("Changes saved to your account."); return true }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save. Your response is still here."); return false }
    finally { setBusy(false) }
  }
  const task = workspace?.tasks.find(t => t.id === selectedId)
  return <div className="oc-dashboard-detail space-y-4 py-5" data-saving={busy}>{notice && <p role="status" data-confirmed="true">{notice}</p>}{error && <p role="alert">{error} <Button variant="outline" disabled={busy} onClick={() => setRetry(n => n + 1)}>Retry assignment</Button></p>}{!workspace && !error && <LoadingState label="Loading assignment…" layout="form" rows={2} />}{workspace && !task && <p role="alert">This assignment is no longer available.</p>}{workspace && selectedId !== taskId && <Button variant="ghost" onClick={() => setSelectedId(taskId)}>Back to project</Button>}{workspace && task && (review && workspace.manage ? <TaskReviewWorkspace workspace={workspace} entries={taskReviewQueue(workspace.tasks)} startId={assignmentId} run={run} busy={busy} onBack={onClose} onDirty={() => {}} /> : <TaskDetail task={task} workspace={workspace} manager={false} run={run} busy={busy} onOpen={task => setSelectedId(task.id)} />)}</div>
}
