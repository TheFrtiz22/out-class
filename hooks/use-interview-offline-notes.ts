"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { useAutosaveRecovery } from "@/hooks/use-autosave-recovery"
import { AUTOSAVE_PREFIX, browserOnline, type DraftWriteResult } from "@/lib/autosave-store"
import type { InterviewDraft, InterviewSessionData } from "@/lib/interview-kits"
import { deleteOfflineNotes, interviewNotesOnly, notesFingerprint, OFFLINE_NOTES_MAX_AGE, OFFLINE_NOTES_MESSAGE, OFFLINE_NOTES_UNREADABLE, offlineNotesKey, offlineNotesSupported, offlineNotesText, onOfflineNotesChange, readOfflineNotes, validNotesOwner, writeOfflineNotes, type InterviewNotesScope, type LocalInterviewNotes, type OfflineNotesCopy } from "@/lib/interview-offline-notes"

/** Device writes wait for a short pause in typing; blur, offline, pagehide and unmount write at once. */
export const OFFLINE_NOTES_WRITE_DELAY = 300
type TabCopy = Pick<OfflineNotesCopy, "sessionId" | "revision" | "baseline" | "value" | "at">

/**
 * Interview-room notes that survive a dropped connection and a reload (docs/interview-offline-notes.md).
 * Wraps the room's existing recovery lifecycle (useAutosaveRecovery: reconnect flush, unload guard,
 * navigation flush). For a signed-in account outside Demo Mode and support sessions, the interviewer's
 * own unsaved notes are kept in an encrypted IndexedDB copy; when that copy cannot be written (private
 * mode, quota, storage errors), cannot be opened, or another tab has replaced it, they fall back to this
 * tab's sessionStorage, as before this feature.
 *
 * On load, a copy is restored into the editor only when the server is exactly where the copy left it
 * (same session, revision and notes); the room's autosave then saves it through the existing revision
 * check. Otherwise the existing conflict choice is shown and neither side is overwritten.
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
  // Known from the first client render. Only status text depends on it, and that text appears after a
  // failed save or an offline event, never on hydration.
  const [supported] = useState(() => typeof window !== "undefined" && offlineNotesSupported())
  // Latched for the page: a transient `user: null` (a failed /api/users/me while offline, 401 or 5xx)
  // never switches storage modes or stops the device copy. A different account replaces it; Demo Mode
  // or a support session turns it off.
  const latched = useRef<string | null>(null)
  if (!supported || demo.isDemoEnabled || isImpersonating) latched.current = null
  else if (validNotesOwner(user?.id)) latched.current = user!.id
  const owner = latched.current
  const completed = !!session?.completedAt
  const base = useAutosaveRecovery({ identity: `interview:${session?.id}`, value: draft, baseline: saved, dirty, enabled: !!session && !completed, restore, flush, tabCopy: !owner })

  const [online, setOnline] = useState(true)
  const latest = useRef({ reconnect, session, draft, saved, restore }); latest.current = { reconnect, session, draft, saved, restore }
  const { clubId, applicationId, roundId } = scope
  const scopeRef = useRef(scope); scopeRef.current = scope
  const [readFor, setReadFor] = useState<string | null>(null)
  const [conflict, setConflict] = useState<LocalInterviewNotes | null>(null), [reviewing, setReviewing] = useState(false)
  /** This tab's latest notes are the device copy. */
  const [stored, setStored] = useState(false)
  /** The last device write failed: notes go to this tab's sessionStorage instead. */
  const [deviceFailed, setDeviceFailed] = useState(false)
  /** Another tab replaced the device copy while this tab had unsaved notes. */
  const [displaced, setDisplaced] = useState(false)
  // A copy exists but could not be opened: it is kept, never overwritten, and the interviewer is told.
  const [unreadable, setUnreadable] = useState(false)
  const [unopened, setUnopened] = useState<LocalInterviewNotes | null>(null)
  const [rewrite, setRewrite] = useState(0)

  // ---- this tab's fallback copy (sessionStorage, owner-keyed, cleared by sign-out and account switch)
  const tabKey = owner ? `${AUTOSAVE_PREFIX}v2:${owner}:interview-notes:${clubId}:${applicationId}:${roundId}` : null
  const readTab = useCallback((): TabCopy | null => {
    if (!tabKey) return null
    try {
      const raw = sessionStorage.getItem(tabKey), copy = raw ? JSON.parse(raw) as TabCopy : null
      if (copy && typeof copy.at === "number" && Date.now() - copy.at <= OFFLINE_NOTES_MAX_AGE && copy.value && typeof copy.baseline === "string") return copy
      if (raw) sessionStorage.removeItem(tabKey)
    } catch { /* Unavailable storage never blocks editing. */ }
    return null
  }, [tabKey])
  const writeTab = useCallback((copy: TabCopy) => { if (tabKey) try { sessionStorage.setItem(tabKey, JSON.stringify(copy)) } catch { /* The unload guard remains. */ } }, [tabKey])
  const removeTab = useCallback(() => { if (tabKey) try { sessionStorage.removeItem(tabKey) } catch { /* Ignore. */ } }, [tabKey])

  // Session could not be opened (offline): show this interviewer's own copy read-only until reconnecting.
  useEffect(() => {
    if (!owner || session) return
    let current = true
    void readOfflineNotes(owner, scopeRef.current).then(read => {
      if (!current) return
      const tab = readTab(), newest = [read.copy, tab].filter(Boolean).sort((a, b) => b!.at - a!.at)[0]
      setUnopened(newest?.value ?? null); setUnreadable(read.unreadable)
    })
    return () => { current = false }
  }, [owner, session, clubId, applicationId, roundId, readTab])

  // Opened: decide once per session whether the newest copy (device or this tab) is restored, discarded
  // or shown as a conflict.
  const sessionId = session?.id ?? null
  useEffect(() => {
    if (!owner || !sessionId || readFor === sessionId) return
    let current = true
    void (async () => {
      const read = await readOfflineNotes(owner, scopeRef.current)
      if (!current) return
      setUnreadable(read.unreadable)
      const { session: record, saved: savedNow, draft: draftNow } = latest.current
      if (!record || record.id !== sessionId) return
      setUnopened(null)
      const tab = readTab(), copy = [read.copy, tab].filter(Boolean).sort((a, b) => b!.at - a!.at)[0] ?? null
      if (copy) {
        const server = savedNow ? JSON.parse(savedNow) as InterviewDraft : null, serverNotes = server ? notesFingerprint(server) : ""
        if (server && notesFingerprint(copy.value) === serverNotes) {
          // The server already has these notes.
          if (read.copy) await deleteOfflineNotes(owner, scopeRef.current)
          removeTab()
        }
        // Same session, revision and notes as when the copy was made, and nothing typed since loading: continue.
        else if (server && !record.completedAt && copy.sessionId === record.id && copy.revision === record.revision && copy.baseline === serverNotes && notesFingerprint(draftNow) === serverNotes) latest.current.restore({ ...server, ...copy.value })
        // Server moved on, submitted elsewhere, or a different session record: keep the copy and ask.
        else if (current) setConflict(copy.value)
      }
      if (current) setReadFor(sessionId)
    })()
    return () => { current = false }
  }, [owner, sessionId, readFor, readTab, removeTab])

  // ---- keep the copy in step with unsaved notes
  const notes = notesFingerprint(draft)
  let savedNotes = ""
  try { savedNotes = saved ? notesFingerprint(JSON.parse(saved) as InterviewDraft) : "" } catch { savedNotes = "" }
  // A submitted session's server draft can differ in shape from the submitted snapshot (canonical
  // evaluation fields); matching either one means nothing is unsaved.
  const unsaved = !!sessionId && notes !== savedNotes && !(completed && session && notes === notesFingerprint(session.draft))
  const revision = session?.revision
  const useTab = deviceFailed || unreadable || displaced
  const pendingWrite = useRef<(() => void) | null>(null), written = useRef("")
  const flushWrite = useCallback(() => { const write = pendingWrite.current; pendingWrite.current = null; write?.() }, [])
  useEffect(() => {
    pendingWrite.current = null
    if (!owner || !sessionId || readFor !== sessionId || conflict || revision === undefined) return
    if (!unsaved) {
      // The server confirmed these notes (or this tab submitted them): delete this tab's copies only.
      written.current = ""
      void deleteOfflineNotes(owner, scopeRef.current, { onlyMine: true }); removeTab(); setStored(false); setDisplaced(false)
      return
    }
    // Submitted elsewhere while this tab still holds unsaved text: keep the copy as it is; it is offered
    // as a conflict when the interview is reopened and deleted only when the interviewer dismisses it.
    if (completed) return
    const copy: OfflineNotesCopy = { owner, scope: scopeRef.current, sessionId, revision, baseline: savedNotes, value: interviewNotesOnly(latest.current.draft), at: Date.now() }
    if (useTab) writeTab(copy)
    // Only new notes (or another tab's request after its save) go to the device again. A status change
    // alone (displaced, failed) never retries, so two tabs cannot bounce the copy between them.
    const signature = `${notes}|${savedNotes}|${revision}|${rewrite}`
    if (signature === written.current) return
    let current = true
    pendingWrite.current = () => {
      written.current = signature
      if (unreadable) { writeTab(copy); return }
      void writeOfflineNotes(copy).then(ok => {
        if (ok) removeTab(); else writeTab(copy)
        if (!current) return
        setDeviceFailed(!ok); setStored(ok); if (ok) setDisplaced(false)
      })
    }
    const timer = setTimeout(flushWrite, OFFLINE_NOTES_WRITE_DELAY)
    return () => { current = false; clearTimeout(timer) }
  }, [owner, sessionId, readFor, conflict, unreadable, completed, unsaved, notes, savedNotes, revision, useTab, rewrite, writeTab, removeTab, flushWrite])

  // Write at once when the page may go away or the connection drops; and on unmount.
  useEffect(() => {
    const now = () => flushWrite()
    const hidden = () => { if (document.visibilityState === "hidden") flushWrite() }
    window.addEventListener("pagehide", now); window.addEventListener("offline", now); document.addEventListener("visibilitychange", hidden)
    return () => { window.removeEventListener("pagehide", now); window.removeEventListener("offline", now); document.removeEventListener("visibilitychange", hidden); flushWrite() }
  }, [flushWrite])

  // Another tab replaced or deleted this interview's device copy.
  const unsavedRef = useRef(unsaved); unsavedRef.current = unsaved
  useEffect(() => {
    if (!owner) return
    let key: string
    try { key = offlineNotesKey(owner, scopeRef.current) } catch { return }
    return onOfflineNotesChange(change => {
      if (change.key !== key || !unsavedRef.current) return
      // Its write replaced this tab's notes on the device: keep them in this tab until this tab writes again.
      if (change.type === "write") { setDisplaced(true); setStored(false) }
      // It saved and removed its own copy: put this tab's newer notes back on the device.
      else setRewrite(n => n + 1)
    })
  }, [owner, clubId, applicationId, roundId])

  useEffect(() => {
    setOnline(browserOnline())
    const up = () => { setOnline(true); if (!latest.current.session) latest.current.reconnect?.() }
    const down = () => setOnline(false)
    window.addEventListener("online", up); window.addEventListener("offline", down)
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down) }
  }, [])

  const onDevice = stored && unsaved && !displaced
  const copyScope: DraftWriteResult = !owner ? "tab" : onDevice ? "device" : unsaved && useTab ? "tab" : false
  return {
    ...base,
    recovery: conflict ?? base.recovery,
    reviewing: conflict ? reviewing : base.reviewing,
    reviewRecovery: () => { if (conflict) setReviewing(true); else base.reviewRecovery() },
    // "Keep newer version": the interviewer chose the server copy; only then is the kept copy deleted.
    discardRecovery: async () => {
      if (!conflict) return base.discardRecovery()
      if (owner) await deleteOfflineNotes(owner, scopeRef.current)
      removeTab(); setConflict(null); setReviewing(false)
    },
    onBlur: () => { flushWrite(); if (!conflict) base.onBlur() },
    /** Where unsaved notes are kept right now: "device" (encrypted IndexedDB), "tab" (sessionStorage), or false. */
    copyScope,
    /** The exact offline banner text, only while unsaved notes are actually on this device. */
    offlineBanner: owner && !online && !completed && (session ? onDevice : !!unopened) ? OFFLINE_NOTES_MESSAGE : "",
    /** Shown while a saved device copy exists but cannot be opened. */
    deviceNotice: unreadable ? OFFLINE_NOTES_UNREADABLE : "",
    /** Read-only text of this interviewer's kept copy while the session cannot be opened. */
    unopenedText: session ? "" : offlineNotesText(unopened),
  }
}
