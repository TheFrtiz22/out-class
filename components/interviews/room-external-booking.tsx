"use client"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Check, ExternalLink, Info, Pencil } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { ROOM_NAME_MAX_LENGTH, UVA_ROOM_BOOKING_URL, normalizeRoomName, type InterviewRoom } from "@/lib/interview-rooms"

/** OutClass rooms are coordination records only. The physical room is reserved in 25Live. */
export function RoomBookingLink({ size = "sm" }: { size?: "sm" | "default" }) {
  return <Button asChild variant="outline" size={size} className="shrink-0"><a href={UVA_ROOM_BOOKING_URL} target="_blank" rel="noopener noreferrer">Book on 25Live<ExternalLink size={14} aria-hidden /><span className="sr-only"> (opens in a new tab)</span></a></Button>
}

export function RoomBookingNotice() {
  return <aside role="note" aria-label="Room reservations" className="flex flex-col items-start gap-3 rounded-xl sm:flex-row sm:items-center sm:justify-between border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
    <p className="flex min-w-0 items-start gap-2 sm:flex-1"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /><span><strong className="font-medium">Heads up:</strong> Booking a room here only saves it in OutClass. It does not reserve the room with UVA. You still need to book it through 25Live.</span></p>
    <RoomBookingLink />
  </aside>
}

export function RoomSavedReminder({ onDismiss }: { onDismiss: () => void }) {
  return <div role="status" className="flex flex-col items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
    <p className="min-w-0 sm:flex-1">Saved in OutClass. Don’t forget to book this room on 25Live.</p>
    <div className="flex items-center gap-2"><RoomBookingLink /><Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button></div>
  </div>
}

/** Click the name (or the pencil) to rename. Enter or blur saves, Escape cancels; blank reverts. */
export function EditableRoomName({ room, disabled, onRename, className = "text-sm font-medium" }: { room: Pick<InterviewRoom, "id" | "name">; disabled?: boolean; onRename: (name: string) => Promise<void>; className?: string }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(room.name), [saving, setSaving] = useState(false), [error, setError] = useState("")
  const input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), settled = useRef(false)
  useEffect(() => { if (!editing) setDraft(room.name) }, [room.name, editing])
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select() } }, [editing])
  function start() { if (disabled || saving) return; settled.current = false; setDraft(room.name); setError(""); setEditing(true) }
  // Return focus to the name only for keyboard saves/cancels; a blur already moved focus elsewhere.
  function finish(refocus: boolean) { setEditing(false); if (refocus) requestAnimationFrame(() => trigger.current?.focus()) }
  async function commit(refocus: boolean) {
    if (settled.current) return
    settled.current = true
    // An untouched legacy name (longer than the cap) is never silently truncated.
    if (draft === room.name) { finish(refocus); return }
    const name = normalizeRoomName(draft, room.name)
    if (name === room.name) { finish(refocus); return }
    setSaving(true); setError("")
    try { await onRename(name); finish(refocus) }
    // Keep the editor open with the typed name so the user can fix it, retry, or press Escape.
    catch (e) { setError(e instanceof Error ? e.message : "Could not rename room."); settled.current = false; requestAnimationFrame(() => input.current?.focus()) }
    finally { setSaving(false) }
  }
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void commit(true) }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); settled.current = true; setDraft(room.name); setError(""); finish(true) }
  }
  return <span className="inline-flex min-w-0 flex-col">
    {editing
      ? <Input ref={input} aria-label="Room name" maxLength={ROOM_NAME_MAX_LENGTH} disabled={saving} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={key} onBlur={() => void commit(false)} className="h-8 px-2" />
      : <span className="inline-flex min-w-0 items-center gap-1"><button ref={trigger} type="button" disabled={disabled || saving} onClick={start} title="Rename room" className={`${className} min-w-0 cursor-text break-words text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default`}>{room.name}<span className="sr-only"> (rename)</span></button><IconButton size="icon-sm" tabIndex={-1} disabled={disabled || saving} onClick={start} aria-label={`Edit name of ${room.name}`} className="text-muted-foreground"><Pencil size={14} aria-hidden /></IconButton></span>}
    {error && <span role="alert" className="mt-1 text-control text-destructive">{error}</span>}
  </span>
}

/** Tracking only: lets leaders record that they also reserved the room in 25Live. */
export function ExternalBookingToggle({ room, disabled, onChange }: { room: Pick<InterviewRoom, "id" | "name" | "externallyBookedAt">; disabled?: boolean; onChange: (booked: boolean) => void }) {
  const id = `room-25live-${room.id}`
  return <label htmlFor={id} className="inline-flex min-h-9 items-center gap-2 text-control">
    <input id={id} type="checkbox" checked={!!room.externallyBookedAt} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    Booked on 25Live{room.externallyBookedAt && <Check size={14} weight="bold" aria-hidden className="text-emerald-700" />}
  </label>
}

export function NotBookedTag() {
  // .oc-status-label sets color: inherit; the amber accent and text are set inline so the flag reads as amber.
  return <span className="oc-status-label bg-amber-50 px-2 py-0.5 text-xs font-medium" style={{ color: "var(--color-amber-800)", ["--badge-accent" as string]: "var(--color-amber-500)" }}>Not booked on 25Live yet</span>
}
