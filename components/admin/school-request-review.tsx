"use client"

import { useEffect, useState } from "react"
import type { SchoolRequest } from "@prisma/client"
import { listSchoolRequests, reviewSchoolRequest } from "@/actions/school-requests"
import { schoolRequestStatuses, schoolRequestRoleLabels, type schoolRequestRoles } from "@/lib/school-requests"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect } from "@/components/ui/native-select"

function RequestReview({ row, onReviewed }: { row: SchoolRequest; onReviewed: () => void }) {
  const [status, setStatus] = useState(row.status)
  const [note, setNote] = useState(row.reviewNote || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return <article className="space-y-4 rounded-xl border bg-card p-5">
    <div><p className="text-sm text-muted-foreground">{row.status.replaceAll("_", " ")} · {new Date(row.createdAt).toLocaleDateString()}</p><h2 className="text-xl font-semibold">{row.university}</h2></div>
    <p>{row.fullName} · {schoolRequestRoleLabels[row.role as (typeof schoolRequestRoles)[number]]}<br /><a className="break-all underline" href={`mailto:${row.email}`}>{row.email}</a>{row.organization && <><br />{row.organization}</>}</p>
    {row.message && <p className="whitespace-pre-wrap break-words text-sm">{row.message}</p>}
    {row.reviewedAt && <p className="text-xs text-muted-foreground">Last reviewed {new Date(row.reviewedAt).toLocaleString()} by {row.reviewedBy}</p>}
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      setBusy(true); setError("")
      try { await reviewSchoolRequest({ id: row.id, revision: row.revision, status, note }); onReviewed() }
      catch (e) { setError(e instanceof Error ? e.message : "Review could not be saved.") }
      finally { setBusy(false) }
    }}>
      <label className="block space-y-1"><span className="text-sm">Review status</span><NativeSelect className="block" value={status} onChange={event => setStatus(event.target.value)}>{schoolRequestStatuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</NativeSelect></label>
      <label className="block space-y-1"><span className="text-sm">Review note</span><Textarea required minLength={10} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button disabled={busy || note.trim().length < 10} type="submit">{busy ? "Saving…" : "Save review"}</Button>
    </form>
  </article>
}

export function SchoolRequestReview() {
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ rows: SchoolRequest[]; hasMore: boolean }>({ rows: [], hasMore: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true); setError("")
    listSchoolRequests({ status, page }).then(data => { if (live) setResult(data) }).catch(e => { if (live) setError(e instanceof Error ? e.message : "Requests unavailable.") }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [status, page, refresh])
  return <section className="space-y-5">
    <p className="text-sm text-muted-foreground">These are expressions of interest. Reviewing or closing a request never approves a university or grants account access.</p>
    <label className="block space-y-1"><span>Filter by status</span><NativeSelect className="block" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="">All requests</option>{schoolRequestStatuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</NativeSelect></label>
    {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Try again</Button></div>}
    {loading ? <p role="status">Loading school requests…</p> : !error && <>
      {result.rows.length ? result.rows.map(row => <RequestReview key={`${row.id}:${row.revision}`} row={row} onReviewed={() => setRefresh(value => value + 1)} />) : <p>No matching school requests.</p>}
      <div className="flex items-center gap-4"><Button variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page + 1}</span><Button variant="outline" disabled={!result.hasMore} onClick={() => setPage(value => value + 1)}>Next</Button></div>
    </>}
  </section>
}
