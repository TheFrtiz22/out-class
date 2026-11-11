"use client"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import type { AutosaveHandle } from "@/hooks/use-autosave"
import { recoveryText } from "@/lib/autosave-store"
type StatusHandle = Pick<AutosaveHandle, "state" | "error" | "flush"> & { retry?: () => void; recovery?: unknown; restoreRecovery?: () => void; discardRecovery?: () => Promise<void>; recoveryKind?: "local" | "conflict" | "draft"; reviewRecovery?: () => void; reviewing?: boolean }
export function AutosaveStatus({ save }: { save: StatusHandle }) {
  const retry = () => save.retry ? save.retry() : void save.flush().catch(() => {})
  const discard = () => void save.discardRecovery?.().catch(() => {})
  if (save.recovery != null) {
    if (save.recoveryKind === "draft") return <div className="text-xs text-muted-foreground" role="status">A draft from an earlier version is available. <button type="button" className="underline" onClick={save.restoreRecovery}>Restore draft</button>{" · "}<button type="button" className="underline" onClick={discard}>Discard old draft</button></div>
    // A copy the server has moved past is never restored or saved: keep the newer version, or read the copy.
    if (save.recoveryKind !== "local") return <div className="space-y-2 text-xs text-muted-foreground" role="status">
      <p>This device has changes from before a newer version was saved elsewhere. <button type="button" className="underline" onClick={discard}>Keep newer version</button>{!save.reviewing && <>{" · "}<button type="button" className="underline" onClick={save.reviewRecovery}>Review my copy</button></>}</p>
      {save.reviewing && <textarea readOnly aria-label="Your earlier copy (read-only)" className="w-full rounded-md border bg-muted/40 p-2 text-sm text-foreground" rows={6} value={recoveryText(save.recovery)} />}
    </div>
    return <div className="text-xs text-muted-foreground" role="status">Unsaved changes from this device are available. <button type="button" className="underline" onClick={save.restoreRecovery}>Restore draft</button>{" · "}<button type="button" className="underline" onClick={discard}>Discard</button></div>
  }
  if (save.state === "idle") return null
  const connection = save.state === "offline" || save.state === "unreachable"
  return <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
    {connection ? <><span>{save.error || (save.state === "offline" ? "Offline — changes save when you reconnect" : "Couldn’t reach OutClass")}</span><button type="button" className="underline" onClick={retry}>Retry</button></>
      : save.state === "error" ? <><span>Couldn’t save. </span><button type="button" className="underline" onClick={retry}>Retry</button>{save.error && <span className="ml-2">{save.error}</span>}</>
      : save.state === "saved" ? "Saved" : <><LoadingIndicator size="sm" /><span>Saving…</span></>}
  </div>
}
