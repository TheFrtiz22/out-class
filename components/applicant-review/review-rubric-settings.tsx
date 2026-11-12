"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { IconButton } from "@/components/ui/icon-button"
import { LoadingState } from "@/components/ui/loading-state"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@/components/icons"
import { announceDataChanged } from "@/hooks/use-revalidate"
import { getReviewRubric, saveReviewRubric } from "@/lib/workspace-api"
import { RUBRIC_MAX_CATEGORIES, reviewRubricSchema, rubricScalePresets, type RubricCategory } from "@/lib/review-rubric"

type Row = { id: string; label: string; max: string }
const toRows = (categories: RubricCategory[]): Row[] => categories.map(item => ({ id: item.id, label: item.label, max: String(item.max) }))

/**
 * Grading categories for applicant review (Recruiting settings › Grading). Any number from none (decisions only)
 * to twelve, each out of 5, 10, 100 or a custom maximum. Reviewers may score any of them; the overall is their
 * average out of 10. Changing categories affects new grades only; submitted grades keep the categories they used.
 */
export function ReviewRubricSettings({ clubId }: { clubId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saved, setSaved] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    getReviewRubric(clubId).then(result => { if (!current) return; const next = toRows(result.rubric.categories); setRows(next); setSaved(JSON.stringify(next)) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [clubId])
  if (failed) return <p role="alert" className="text-sm">Grading categories couldn’t be loaded. Your access may have changed.</p>
  if (!rows) return <LoadingState label="Loading grading categories…" layout="form" rows={3} />
  const dirty = JSON.stringify(rows) !== saved
  const update = (index: number, patch: Partial<Row>) => setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  const move = (index: number, by: -1 | 1) => { const next = [...rows]; const [row] = next.splice(index, 1); next.splice(index + by, 0, row); setRows(next) }
  const parsed = reviewRubricSchema.safeParse({ categories: rows.map(row => ({ id: row.id, label: row.label.trim(), max: Number(row.max) })) })
  async function save() {
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message === "Name each category." ? "Name each category." : "Each scale must be a whole number from 1 to 100."); return }
    setBusy(true); setMessage("")
    try { const result = await saveReviewRubric({ clubId, rubric: parsed.data }); const next = toRows(result.rubric.categories); setRows(next); setSaved(JSON.stringify(next)); setMessage("Grading categories saved."); announceDataChanged("applicants") }
    catch { setMessage("Couldn’t save grading categories. Check your access and try again.") }
    finally { setBusy(false) }
  }
  return <section className="space-y-4" aria-labelledby="grading-settings-heading" data-unsaved={dirty || undefined}>
    <div className="space-y-1">
      <h3 id="grading-settings-heading" className="oc-card-heading">Grading categories</h3>
      <p className="text-sm text-muted-foreground">Reviewers can score any of these; none is required. The overall is the average, out of 10, and a reviewer can edit it. With no categories, reviewers only Advance, Hold or Reject.</p>
    </div>
    {rows.length ? <ol className="space-y-2">
      {rows.map((row, index) => <li key={row.id} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-40 space-y-1"><Label htmlFor={`rubric-label-${row.id}`} className="text-xs">Category {index + 1}</Label><Input id={`rubric-label-${row.id}`} maxLength={60} placeholder="e.g. Charisma" value={row.label} disabled={busy} onChange={event => update(index, { label: event.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor={`rubric-max-${row.id}`} className="text-xs">Out of</Label>
          <div className="flex items-center gap-1">
            <NativeSelect id={`rubric-max-${row.id}`} className="w-24" disabled={busy} value={(rubricScalePresets as readonly number[]).includes(Number(row.max)) ? row.max : "custom"} onChange={event => update(index, { max: event.target.value === "custom" ? "" : event.target.value })}>
              {rubricScalePresets.map(value => <option key={value} value={String(value)}>{value}</option>)}<option value="custom">Custom</option>
            </NativeSelect>
            {!(rubricScalePresets as readonly number[]).includes(Number(row.max)) && <Input aria-label={`Custom maximum for category ${index + 1}`} type="number" min={1} max={100} step={1} className="w-20" value={row.max} disabled={busy} onChange={event => update(index, { max: event.target.value })} />}
          </div>
        </div>
        <div className="flex">
          <IconButton variant="ghost" aria-label={`Move category ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></IconButton>
          <IconButton variant="ghost" aria-label={`Move category ${index + 1} down`} disabled={busy || index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></IconButton>
          <IconButton variant="ghost" aria-label={`Remove category ${index + 1}`} disabled={busy} onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></IconButton>
        </div>
      </li>)}
    </ol> : <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No categories. Reviewers decide without grading.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy || rows.length >= RUBRIC_MAX_CATEGORIES} onClick={() => setRows([...rows, { id: crypto.randomUUID(), label: "", max: "10" }])}><Plus aria-hidden="true" />Add category</Button>
      <Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : "Save categories"}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
    <p className="text-xs text-muted-foreground">Changes apply to new grades. Submitted grades keep the categories they were scored on.</p>
  </section>
}
