"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getEditorDraft, saveEditorDraft } from "@/actions/editor-drafts"
import { editorDraftKey, type EditorScope } from "@/lib/editor-drafts"
import { useAutosave } from "@/hooks/use-autosave"
import { editorValue, sameEditorBase } from "@/lib/editor-value"

/** Stage private working copies. Calling this hook can never invoke a domain commit action. */
export function useEditorDraft<T>({ scope, value, restore, enabled = true, base = "" }: { scope: EditorScope; value: T; restore: (value: T) => void; enabled?: boolean; base?: string }) {
  const { user } = useAuth(), demo = useDemoMode()
  const identity = `${demo.isDemoEnabled ? "demo:" : ""}${user?.id}:${editorDraftKey({ ...scope, clubId: scope.clubId || undefined, resourceId: scope.resourceId ?? "main" })}`
  const [loaded, setLoaded] = useState("")
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [recovery, setRecovery] = useState<T | null>(null)
  const session = useMemo(() => ({ identity, revision: 0, mutation: null as { text: string; id: string } | null }), [identity])
  const latest = useRef({ scope, value, restore, base }); latest.current = { scope, value, restore, base }
  const userId = user?.id
  const ready = enabled && !!userId && loaded === identity
  useEffect(() => {
    if (!enabled || !userId) return
    let active = true
    setLoaded(""); setLoadError(""); setRecovery(null)
    if (demo.isDemoEnabled) { session.revision = 0; setLoaded(identity); return }
    getEditorDraft(latest.current.scope).then(saved => {
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
  }, [identity, enabled, demo.isDemoEnabled, userId, retry, session])
  const autosave = useAutosave({ identity, value, enabled: ready && recovery === null, restore,
    save: async content => {
      if (demo.isDemoEnabled) return
      const text = JSON.stringify(content)
      if (session.mutation && session.mutation.text !== text) {
        // An earlier request may have committed even though its response was lost.
        const current = await getEditorDraft(scope)
        if (current?.mutationId === session.mutation.id) session.revision = current.revision
        else if ((current?.revision ?? 0) !== session.revision) throw Error("This draft changed in another tab. Your text is retained. Reopen to compare.")
      }
      if (session.mutation?.text !== text) session.mutation = { text, id: crypto.randomUUID() }
      const result = await saveEditorDraft({ scope, revision: session.revision, mutationId: session.mutation.id, base, content })
      if ("error" in result) throw Error(result.message)
      session.revision = result.revision; session.mutation = null
    },
  })
  async function clear() {
    await autosave.flush()
    // A successful domain commit must never be reported as failed because cleanup failed.
    try { sessionStorage.setItem(`outclass:committed-draft:${identity}`, String(session.revision)) } catch {}
    if (!demo.isDemoEnabled) {
      try {
        const result = await saveEditorDraft({ scope, revision: session.revision, mutationId: crypto.randomUUID(), base, content: null })
        if (!("error" in result)) session.revision = result.revision
      } catch { /* The revision tombstone prevents this tab from restoring a consumed draft. */ }
    }
    await autosave.reset()
  }
  return { ...autosave, ready, error: loadError || autosave.error, state: loadError ? "error" as const : autosave.state,
    flush: async () => { if (!ready || recovery !== null) throw Error("Resolve draft recovery before continuing."); await autosave.flush() },
    retry: () => { if (loadError) setRetry(n => n + 1); else void autosave.flush().catch(() => {}) }, clear,
    recovery: recovery ?? autosave.recovery, restoreRecovery: () => { if (recovery !== null) restore(recovery); else autosave.restoreRecovery?.(); setRecovery(null) },
    discardRecovery: async () => { if (recovery !== null) await clear(); else await autosave.discardRecovery?.(); setRecovery(null) },
  }
}
