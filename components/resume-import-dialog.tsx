"use client"
import { useState } from "react"
import { prepareResumeImport, confirmResumeImport } from "@/lib/workspace-api"
import { resumeLabels, reviewPatch, type ResumeField } from "@/lib/resume-import"
import type { FullStudentProfile } from "@/lib/student-profile"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Review = Awaited<ReturnType<typeof prepareResumeImport>>
export function ResumeImportDialog({ profile, onSaved }: { profile: FullStudentProfile; onSaved: (profile: FullStudentProfile) => void }) {
  const demo = useDemoMode(), { refreshUser } = useAuth()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [review, setReview] = useState<Review | null>(null), [values, setValues] = useState<Partial<Record<ResumeField, string>>>({}), [selected, setSelected] = useState<ResumeField[]>([])
  const [entries, setEntries] = useState<{ title: string; subtitle: string; period: string; accepted: boolean }[]>([]), [attach, setAttach] = useState(false)
  function close(next: boolean) { if (busy) return; setOpen(next); setError(""); if (!next) { setReview(null); setSelected([]); setEntries([]); setAttach(false) } }
  async function process(file?: File) {
    if (!file || busy) return
    setBusy(true); setError("")
    try {
      const form = new FormData(); form.set("file", file)
      const result = await prepareResumeImport(form)
      setReview(result); setSelected([]); setAttach(false)
      setValues(Object.fromEntries(result.proposal.fields.map(v => [v.field, v.value || ""])))
      setEntries(result.proposal.experiences.map(v => ({ ...v, accepted: false })))
    } catch (e) { setError(e instanceof Error ? e.message : "Could not extract this PDF. Try another text-based résumé.") }
    finally { setBusy(false) }
  }
  async function confirm() {
    if (!review || busy) return
    setError("")
    let patch
    try { patch = reviewPatch(values, selected) } catch { setError("Check selected values: names and major are required; use valid years and scores."); return }
    setBusy(true)
    try {
      const result = await confirmResumeImport({ patch, baseline: review.baseline, experiences: entries.filter(v => v.accepted).map(({ title, subtitle, period }) => ({ title, subtitle, period })), ...(attach ? { resumeReference: review.reference } : {}) })
      onSaved(result.profile); setOpen(false); setReview(null)
      await refreshUser().catch(() => {})
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Your proposed changes remain here.") }
    finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={close}>
    <DialogTrigger asChild><Button variant="outline" className="mt-4" disabled={demo.isDemoEnabled}>Import PDF into profile</Button></DialogTrigger>
    {demo.isDemoEnabled && <p className="mt-2 text-xs text-muted-foreground">PDF importing is unavailable in Demo Mode; sample profiles stay isolated.</p>}
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={e => { if (busy) e.preventDefault() }} onPointerDownOutside={e => { if (busy) e.preventDefault() }}>
      <DialogHeader><DialogTitle>Import your résumé</DialogTitle><DialogDescription>Upload a text-based PDF, review the suggestions, then confirm. Nothing changes in your profile before confirmation.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <p role="status" aria-live="polite">{review ? "Saving confirmed changes…" : "Processing PDF and preparing suggestions…"}</p>}
      {!review ? <div className="space-y-3"><Label htmlFor="resume-import-file">PDF résumé · up to 10 MB and 10 pages</Label><Input id="resume-import-file" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e => { void process(e.target.files?.[0]); e.target.value = "" }} /><p className="text-xs text-muted-foreground">Scanned/image-only PDFs are unsupported. The document is stored privately after extraction; attaching it to your profile is optional.</p></div> : <div className="space-y-5">
        <p className="text-sm">Select only the changes you want. Checked profile fields replace their existing values; unchecked fields stay unchanged.</p>
        <fieldset disabled={busy} className="space-y-4">{review.proposal.fields.map(item => <div key={item.field} className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selected.includes(item.field)} onChange={e => setSelected(v => e.target.checked ? [...v, item.field] : v.filter(f => f !== item.field))} />Change {resumeLabels[item.field]}</label>
          <p className="text-xs text-muted-foreground">Current: {String(review.baseline[item.field] ?? "Not set")} · {item.status === "found" ? "Found" : item.status === "uncertain" ? "Needs verification" : "Not found"}. {item.note}</p>
          <Label className="sr-only" htmlFor={`import-${item.field}`}>Proposed {resumeLabels[item.field]}</Label><Input id={`import-${item.field}`} value={values[item.field] || ""} onChange={e => setValues(v => ({ ...v, [item.field]: e.target.value }))} />
        </div>)}</fieldset>
        <section className="space-y-3"><h3 className="font-medium">Experience · append selected entries</h3><p className="text-xs text-muted-foreground">Your {profile.experiences.length} existing entries will stay. Exact duplicates are skipped. Work, internships, research and projects use the same title, organization and period fields.</p>
          <fieldset disabled={busy} className="space-y-3">{entries.map((entry, i) => <div key={i} className="space-y-2 rounded-lg border p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entry.accepted} onChange={e => setEntries(v => v.map((x, j) => j === i ? { ...x, accepted: e.target.checked } : x))} />Append entry {i + 1}</label>{(["title", "subtitle", "period"] as const).map(key => <div key={key}><Label htmlFor={`import-entry-${i}-${key}`}>{key === "subtitle" ? "Organization" : key === "title" ? "Title" : "Period"}</Label><Input id={`import-entry-${i}-${key}`} value={entry[key]} onChange={e => setEntries(v => v.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x))} /></div>)}<Button variant="ghost" onClick={() => setEntries(v => v.filter((_, j) => j !== i))}>Remove entry</Button></div>)}<Button variant="outline" disabled={entries.length >= 50} onClick={() => setEntries(v => [...v, { title: "", subtitle: "", period: "", accepted: false }])}>Add experience manually</Button></fieldset>
        </section>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={attach} onChange={e => setAttach(e.target.checked)} /><span>Also attach this PDF to my profile{profile.resumeUrl ? " (replaces my current résumé reference)" : ""}.</span></label>
        <ul className="space-y-1 text-xs text-muted-foreground">{review.proposal.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <Button disabled={busy || (!selected.length && !entries.some(v => v.accepted) && !attach)} onClick={() => void confirm()}>Confirm selected changes</Button>
      </div>}
      <Button variant="ghost" disabled={busy} onClick={() => close(false)}>Cancel</Button>
    </DialogContent>
  </Dialog>
}
