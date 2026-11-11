"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getEditorDraft, saveEditorDraft } from "@/actions/editor-drafts"
import { editorDraftKey, type EditorScope } from "@/lib/editor-drafts"
import { useAutosave } from "@/hooks/use-autosave"
import { editorValue, sameEditorBase } from "@/lib/editor-value"
/** Drafts that hold private data about other students stay in memory and this tab only. */
const TAB_ONLY_KINDS: ReadonlySet<EditorScope["kind"]> = new Set(["review", "voting-setup", "task-feedback"])
type DemoDraftPersistence={read:(scope:EditorScope)=>Promise<{revision:number;mutationId:string;base:string;content:unknown}|null>;write:(input:unknown)=>Promise<{revision:number}|{error:string;message:string}>}

/** Stage private working copies. Calling this hook can never invoke a domain commit action. */
export function useEditorDraft<T>({ scope, value, restore, enabled = true, base = "", demoPersistence }: { demoPersistence?:DemoDraftPersistence; scope: EditorScope; value: T; restore: (value: T) => void; enabled?: boolean; base?: string }) {
  const { user } = useAuth(), demo = useDemoMode()
  const identity = `${demo.isDemoEnabled ? "demo:" : ""}${user?.id}:${editorDraftKey({ ...scope, clubId: scope.clubId || undefined, resourceId: scope.resourceId ?? "main" })}`
  const [loaded, setLoaded] = useState("")
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [recovery, setRecovery] = useState<T | null>(null), [reviewing, setReviewing] = useState(false)
  const session = useMemo(() => ({ identity, revision: 0, mutation: null as { text: string; id: string } | null }), [identity])
  const latest = useRef({ scope, value, restore, base,demoPersistence }); latest.current = { scope, value, restore, base,demoPersistence }
  const userId = user?.id,hasDemoPersistence=!!demoPersistence
  const ready = enabled && !!userId && loaded === identity
  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    setLoaded(""); setLoadError(""); setRecovery(null); setReviewing(false)
    if (demo.isDemoEnabled && !hasDemoPersistence) { session.revision = 0; setLoaded(identity); return }
    (demo.isDemoEnabled?latest.current.demoPersistence!.read(latest.current.scope):getEditorDraft(latest.current.scope)).then(saved => {
      if (!active) return
      session.revision = saved?.revision ?? 0; session.mutation = null
      let committed = 0
      try { committed = Number(sessionStorage.getItem(`outclass:committed-draft:${identity}`) || 0) } catch {}
      if (saved?.content != null && saved.revision > committed) {
        if (sameEditorBase(saved.base, latest.current.base) || editorValue(saved.content) === editorValue(latest.current.value)) latest.current.restore(saved.content as T)
        else setRecovery(saved.content as T)
      }
      setLoaded(identity)
    }).catch(() => { if (active) setLoadError("Couldn't load your draft. Retry before editing.") })
    return () => { active = false }
  }, [identity, enabled, demo.isDemoEnabled, userId, retry, session, hasDemoPersistence])
  const autosave = useAutosave({ identity, value, enabled: ready && recovery === null, restore,
    // Demo drafts never reach device storage; the server EditorDraft row is the cross-device copy.
    owner: demo.isDemoEnabled ? null : userId, persistence: TAB_ONLY_KINDS.has(scope.kind) ? "tab" : "device",
    save: async content => {
      if (demo.isDemoEnabled && !hasDemoPersistence) return
      const text = JSON.stringify(content)
      if (session.mutation && session.mutation.text !== text) {
        // An earlier request may have committed even though its response was lost.
        const current = await (demo.isDemoEnabled?latest.current.demoPersistence!.read(scope):getEditorDraft(scope))
        if (current?.mutationId === session.mutation.id) session.revision = current.revision
        else if ((current?.revision ?? 0) !== session.revision) throw Error("This draft changed in another tab. Your text is retained. Reopen to compare.")
      }
      if (session.mutation?.text !== text) session.mutation = { text, id: crypto.randomUUID() }
      const result = await (demo.isDemoEnabled?latest.current.demoPersistence!.write:saveEditorDraft)({ scope, revision: session.revision, mutationId: session.mutation.id, base, content })
      if ("error" in result) throw Error(result.message)
      session.revision = result.revision; session.mutation = null
    },
  })
  async function clear() {
    await autosave.flush()
    // A successful domain commit must never be reported as failed because cleanup failed.
    try { sessionStorage.setItem(`outclass:committed-draft:${identity}`, String(session.revision)) } catch {}
    if (!demo.isDemoEnabled || hasDemoPersistence) {
      try {
        const result = await (demo.isDemoEnabled?latest.current.demoPersistence!.write:saveEditorDraft)({ scope, revision: session.revision, mutationId: crypto.randomUUID(), base, content: null })
        if (!("error" in result)) session.revision = result.revision
      } catch { /* The revision tombstone prevents this tab from restoring a consumed draft. */ }
    }
    await autosave.reset()
  }
  return { ...autosave, ready, error: loadError || autosave.error, state: loadError ? "error" as const : autosave.state,
    flush: async () => { if (!ready || recovery !== null) throw Error("Resolve draft recovery before continuing."); await autosave.flush() },
    retry: () => { if (loadError) setRetry(n => n + 1); else void autosave.flush().catch(() => {}) }, clear,
    /** After the caller explicitly replaced its form with authoritative saved state, adopt the stored revision so this tab's copy supersedes the other tab's. */
    rebase: async () => {
      if (demo.isDemoEnabled && !hasDemoPersistence) return
      const current = await (demo.isDemoEnabled ? latest.current.demoPersistence!.read(scope) : getEditorDraft(scope))
      session.revision = current?.revision ?? 0; session.mutation = null
      await autosave.flush().catch(() => {})
    },
    recovery: recovery ?? autosave.recovery, // "draft": the user's own server-saved working copy (EditorDraft, revision-checked) from an earlier base.
    // Restoring it only refills the form; the domain commit keeps its own revision check. Local device
    // copies the server has moved past come through autosave as "conflict" and are never restored.
    recoveryKind: recovery !== null ? "draft" as const : autosave.recoveryKind,
    restoreRecovery: () => { if (recovery !== null) { restore(recovery); setRecovery(null); setReviewing(false) } else autosave.restoreRecovery?.() },
    reviewRecovery: () => { if (recovery !== null) setReviewing(true); else autosave.reviewRecovery?.() },
    reviewing: recovery !== null ? reviewing : autosave.reviewing,
    discardRecovery: async () => { if (recovery !== null) await clear(); else await autosave.discardRecovery?.(); setRecovery(null); setReviewing(false) },
  }
}
