"use client"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-mode"
import { useAutosaveRecovery } from "@/hooks/use-autosave-recovery"
import { browserOnline, type DraftWriteResult } from "@/lib/autosave-store"
import type { InterviewDraft, InterviewSessionData } from "@/lib/interview-kits"
import { deleteOfflineNotes, interviewNotesOnly, notesFingerprint, OFFLINE_NOTES_MESSAGE, offlineNotesSupported, offlineNotesText, readOfflineNotes, validNotesOwner, writeOfflineNotes, type InterviewNotesScope, type LocalInterviewNotes } from "@/lib/interview-offline-notes"

/**
 * Interview-room notes that survive a dropped connection and a reload (docs/interview-offline-notes.md).
 * Wraps the room's existing recovery lifecycle (useAutosaveRecovery: reconnect flush, unload guard,
 * navigation flush) and replaces its tab-only copy with an encrypted IndexedDB copy of the
 * interviewer's own unsaved notes, for a signed-in account outside Demo Mode and support sessions.
 *
 * On load, a copy is restored into the editor only when the server is exactly where the copy left it
 * (same session, revision and notes); the room's autosave then saves it through the existing revision
 * check. If the server moved on, the existing conflict choice is shown and neither side is overwritten.
 */
export function useInterviewOfflineNotes({ scope, session, draft, saved, dirty, restore, flush, reconnect }: {
  scope: InterviewNotesScope
  session: InterviewSessionData | null
  draft: InterviewDraft
  /** JSON of the server-acknowledged draft. */
  saved: string
  dirty: boolean
  restore: (draft: InterviewDraft) => void
  flush: () => Promise<void>
  /** Reload the session after reconnecting when it could not be opened offline. */
  reconnect?: () => void
}) {
  const { user, isImpersonating } = useAuth(), demo = useDemoMode()
  // Decided after mount: IndexedDB is a browser-only capability.
  const [supported, setSupported] = useState(false)
  useEffect(() => { setSupported(offlineNotesSupported()) }, [])
  const owner = supported && !demo.isDemoEnabled && !isImpersonating && validNotesOwner(user?.id) ? user!.id : null
  const completed = !!session?.completedAt
  const base = useAutosaveRecovery({ identity: `interview:${session?.id}`, value: draft, baseline: saved, dirty, enabled: !!session && !completed, restore, flush, tabCopy: !owner })

  const [online, setOnline] = useState(true)
  const latest = useRef({ reconnect, session, draft, saved, restore }); latest.current = { reconnect, session, draft, saved, restore }
  useEffect(() => {
    setOnline(browserOnline())
    const up = () => { setOnline(true); if (!latest.current.session) latest.current.reconnect?.() }
    const down = () => setOnline(false)
    window.addEventListener("online", up); window.addEventListener("offline", down)
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down) }
  }, [])

  const { clubId, applicationId, roundId } = scope
  const scopeRef = useRef(scope); scopeRef.current = scope
  const [readFor, setReadFor] = useState<string | null>(null)
  const [conflict, setConflict] = useState<LocalInterviewNotes | null>(null), [reviewing, setReviewing] = useState(false)
  const [stored, setStored] = useState(false)
  const [unopened, setUnopened] = useState<LocalInterviewNotes | null>(null)

  // Session could not be opened (offline): show this interviewer's own copy read-only until reconnecting.
  useEffect(() => {
    if (!owner || session) return
    let current = true
    void readOfflineNotes(owner, scopeRef.current).then(copy => { if (current) setUnopened(copy?.value ?? null) })
    return () => { current = false }
  }, [owner, session, clubId, applicationId, roundId])

  // Opened: decide once per session whether the device copy is restored, discarded or a conflict.
  const sessionId = session?.id ?? null
  useEffect(() => {
    if (!owner || !sessionId || readFor === sessionId) return
    let current = true
    void (async () => {
      const copy = await readOfflineNotes(owner, scopeRef.current)
      if (!current) return
      const { session: record, saved: savedNow, draft: draftNow } = latest.current
      if (!record || record.id !== sessionId) return
      setUnopened(null)
      if (copy) {
        const server = savedNow ? JSON.parse(savedNow) as InterviewDraft : null, serverNotes = server ? notesFingerprint(server) : ""
        const local = notesFingerprint(copy.value)
        if (record.completedAt || copy.sessionId !== record.id || !server || local === serverNotes) await deleteOfflineNotes(owner, scopeRef.current)
        // Same revision and notes as when the copy was made, and nothing typed since loading: continue.
        else if (copy.revision === record.revision && copy.baseline === serverNotes && notesFingerprint(draftNow) === serverNotes) latest.current.restore({ ...server, ...copy.value })
        else if (current) setConflict(copy.value)
      }
      if (current) setReadFor(sessionId)
    })()
    return () => { current = false }
  }, [owner, sessionId, readFor])

  // Keep the copy in step with unsaved notes; delete it once the server has them or the review is submitted.
  const notes = notesFingerprint(draft)
  let savedNotes = ""
  try { savedNotes = saved ? notesFingerprint(JSON.parse(saved) as InterviewDraft) : "" } catch { savedNotes = "" }
  const revision = session?.revision
  useEffect(() => {
    if (!owner || !sessionId) return
    if (completed) { void deleteOfflineNotes(owner, scopeRef.current); setStored(false); return }
    if (readFor !== sessionId || conflict) return
    if (notes === savedNotes || revision === undefined) { void deleteOfflineNotes(owner, scopeRef.current); setStored(false); return }
    let current = true
    void writeOfflineNotes({ owner, scope: scopeRef.current, sessionId, revision, baseline: savedNotes, value: interviewNotesOnly(latest.current.draft), at: Date.now() })
      .then(ok => { if (current) setStored(ok) })
    return () => { current = false }
  }, [owner, sessionId, readFor, conflict, completed, notes, savedNotes, revision])

  const copyScope: DraftWriteResult = owner ? (stored ? "device" : false) : "tab"
  return {
    ...base,
    recovery: conflict ?? base.recovery,
    reviewing: conflict ? reviewing : base.reviewing,
    reviewRecovery: () => { if (conflict) setReviewing(true); else base.reviewRecovery() },
    // "Keep newer version": the interviewer chose the server copy; only then is the device copy deleted.
    discardRecovery: async () => {
      if (!conflict) return base.discardRecovery()
      if (owner) await deleteOfflineNotes(owner, scopeRef.current)
      setConflict(null); setReviewing(false)
    },
    onBlur: () => { if (!conflict) base.onBlur() },
    /** Where unsaved notes are kept right now: "device" (encrypted IndexedDB), "tab" (Demo/support/unsupported), or false. */
    copyScope,
    /** The exact offline banner text while notes are kept on this device, else "". */
    offlineBanner: owner && !online && !completed && (session ? stored || !dirty : !!unopened) ? OFFLINE_NOTES_MESSAGE : "",
    /** Read-only text of this interviewer's device copy while the session cannot be opened. */
    unopenedText: session ? "" : offlineNotesText(unopened),
  }
}
