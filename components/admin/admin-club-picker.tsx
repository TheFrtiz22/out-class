"use client"
import { useEffect, useId, useState } from "react"
import { getAdminClubs } from "@/actions/admin-clubs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type PickedClub = { id: string; name: string; schoolName: string }

/** Searchable club choice for admin forms, backed by the Clubs page read (requirePlatformAdmin).
 * Lists active clubs by name, slug or category; the form submits only the chosen club's id. */
export function AdminClubPicker({ label, value, onChange, disabled = false }: { label: string; value: PickedClub | null; onChange: (club: PickedClub | null) => void; disabled?: boolean }) {
  const id = useId(), [query, setQuery] = useState(""), [rows, setRows] = useState<PickedClub[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    const q = query.trim()
    if (value || !q) { setRows([]); setLoading(false); return }
    let live = true; setLoading(true)
    const timer = setTimeout(() => {
      getAdminClubs({ query: q, status: "ACTIVE" })
        .then(r => { if (live) { setRows(r.rows.slice(0, 8).map(c => ({ id: c.id, name: c.name, schoolName: c.school.name }))); setError("") } })
        .catch(() => { if (live) { setRows([]); setError("Couldn’t search clubs. Try again.") } })
        .finally(() => { if (live) setLoading(false) })
    }, 200)
    return () => { live = false; clearTimeout(timer) }
  }, [query, value])
  if (value) return <div className="oc-field" role="group" aria-labelledby={`${id}-label`}>
    <span id={`${id}-label`}>{label}</span>
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <span className="min-w-0 break-words">{value.name}<small className="block text-muted-foreground">{value.schoolName}</small></span>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(null); setQuery("") }}>Change</Button>
    </div>
  </div>
  return <div className="oc-field">
    <label htmlFor={id}>{label}</label>
    <Input id={id} type="search" autoComplete="off" placeholder="Search by name or slug" value={query} disabled={disabled} aria-describedby={`${id}-status`} onChange={e => setQuery(e.target.value)} />
    <p id={`${id}-status`} role="status" className="text-xs font-normal text-muted-foreground">{error || (loading ? "Searching…" : query.trim() && !rows.length ? "No active clubs match." : "")}</p>
    {rows.length > 0 && <ul aria-label={`${label} results`} className="divide-y rounded-md border bg-card">{rows.map(c => <li key={c.id}>
      <button type="button" className="w-full px-3 py-2 text-left text-sm font-normal hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => onChange(c)}>{c.name}<small className="block text-muted-foreground">{c.schoolName}</small></button>
    </li>)}</ul>}
  </div>
}
