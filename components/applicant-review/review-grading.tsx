"use client"
import { useEffect, useMemo, useState } from "react"
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { AutosaveStatus } from "@/components/ui/autosave-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitEvaluation } from "@/lib/workspace-api"
import { findReviewerEvaluation } from "@/lib/reviewer-evaluation"
import { canonicalEvaluationScore, formatOverall, rubricOverall, rubricScoresSchema, type ReviewRubric, type RubricScores } from "@/lib/review-rubric"

type Draft = { scores: Record<string, string>; overall: string; override: boolean; notes: string }
const emptyDraft: Draft = { scores: {}, overall: "", override: false, notes: "" }
type Evaluation = { id: string; interviewerId: string; roundId: string | null; round: string; score: number; submittedAt: Date | string | null; rubricScores?: unknown }
type App = { id: string; roundId: string; canEvaluate?: boolean; evaluations: Evaluation[] }

/** Older review drafts stored `{ score, notes }`; they restore into the Overall field. */
function readDraft(value: unknown): Draft {
  if (!value || typeof value !== "object") return emptyDraft
  const v = value as Partial<Draft> & { score?: string }
  return { scores: v.scores && typeof v.scores === "object" ? v.scores : {}, overall: typeof v.overall === "string" ? v.overall : typeof v.score === "string" ? v.score : "", override: v.override === true || (!v.scores && typeof v.score === "string" && v.score !== ""), notes: typeof v.notes === "string" ? v.notes : "" }
}
const stepFor = (max: number) => max <= 10 ? 0.5 : 1

/**
 * Grading for one applicant: the club's categories (each on its own scale), an overall out of 10 that follows the
 * categories unless edited, and an optional comment. Entries autosave as a private draft; Submit grade records the
 * evaluation (submitted grades can't be changed) and updates the Rating column. No category is required.
 */
export function ReviewGrading({ clubId, app, roundName, rubric, memberId, reason, rounds, onSubmitted, disabled = false }: {
  clubId: string; app: App; roundName: string; rubric: ReviewRubric; memberId: string; reason: string; disabled?: boolean
  rounds: { id: string; name: string }[]; onSubmitted: () => void
}) {
  const canEvaluate = app.canEvaluate === true
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [base, setBase] = useState(JSON.stringify(emptyDraft))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const save = useEditorDraft({ scope: { kind: "review", clubId, resourceId: `${app.id}:${app.roundId}` }, value: draft, restore: value => setDraft(readDraft(value)), enabled: canEvaluate, base })
  useEffect(() => { setDraft(emptyDraft); setBase(JSON.stringify(emptyDraft)); setMessage("") }, [app.id, app.roundId])

  const mine = findReviewerEvaluation(app.evaluations, memberId, rounds.find(round => round.id === app.roundId))
  const submitted = mine?.submittedAt ? rubricScoresSchema.safeParse(mine.rubricScores) : null
  const entries = rubric.categories.map(category => ({ ...category, raw: draft.scores[category.id] ?? "" }))
  const scored = entries.filter(item => item.raw.trim() !== "" && Number.isFinite(Number(item.raw)))
  const invalid = scored.find(item => Number(item.raw) < 0 || Number(item.raw) > item.max)
  const computed = useMemo(() => rubricOverall(scored.map(item => ({ score: Number(item.raw), max: item.max }))), [scored])
  const overall = draft.override ? (draft.overall.trim() === "" ? null : Number(draft.overall)) : computed
  const overallInvalid = overall !== null && (!Number.isFinite(overall) || overall < 0 || overall > 10)
  const stored = overall !== null && !overallInvalid ? canonicalEvaluationScore(overall) : null
  const ready = canEvaluate && !busy && !disabled && save.ready && save.recovery == null && stored !== null && !invalid
  const set = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }))

  async function submit() {
    if (!ready || stored === null || overall === null) return
    setBusy(true); setMessage("")
    try {
      await save.flush()
      const rubricScores: RubricScores | undefined = rubric.categories.length ? { categories: scored.map(item => ({ id: item.id, label: item.label, max: item.max, score: Number(item.raw) })), overall: Math.round(overall * 10) / 10, overridden: draft.override || !scored.length } : undefined
      await submitEvaluation({ clubId, applicationId: app.id, roundId: app.roundId, roundName, score: stored, notes: draft.notes, ...(rubricScores ? { rubricScores } : {}) })
      await save.clear()
      setBase(JSON.stringify(draft))
      setMessage("Grade submitted.")
      onSubmitted()
    } catch { setMessage("Couldn’t submit this grade. Your entries are still here. Check your access, then try again.") }
    finally { setBusy(false) }
  }

  if (!rubric.categories.length) return null
  if (mine?.submittedAt) return <section className="oc-review-grading" aria-labelledby="grading-heading">
    <h3 id="grading-heading" className="oc-review-panel-heading">Your grade</h3>
    {submitted?.success ? <ul className="oc-review-grade-list">{submitted.data.categories.map(item => <li key={item.id}><span>{item.label}</span><span className="tabular-nums">{item.score}/{item.max}</span></li>)}</ul> : null}
    <p className="oc-review-overall"><span className="tabular-nums">{formatOverall(submitted?.success ? submitted.data.overall : mine.score)}</span><span className="oc-review-overall-scale">/10</span></p>
    <p className="text-xs text-muted-foreground">Submitted grades can’t be changed.</p>
  </section>

  return <section className="oc-review-grading" aria-labelledby="grading-heading" data-autosave-editor="true" onBlur={canEvaluate ? save.onBlur : undefined} data-unsaved={canEvaluate && JSON.stringify(draft) !== base || undefined}>
    <div className="flex items-baseline justify-between gap-2"><h3 id="grading-heading" className="oc-review-panel-heading">Grade</h3>{canEvaluate && <AutosaveStatus save={save} />}</div>
    {!canEvaluate && <p className="text-xs text-muted-foreground">{reason}</p>}
    <div className="oc-review-categories">
      {entries.map(item => <div key={item.id} className="oc-review-category">
        <Label htmlFor={`grade-${item.id}`} className="min-w-0 truncate">{item.label}</Label>
        <span className="flex items-center gap-1">
          <Input id={`grade-${item.id}`} type="number" inputMode="decimal" min={0} max={item.max} step={stepFor(item.max)} placeholder="–" className="oc-review-score-input" aria-describedby={`grade-${item.id}-scale`}
            value={item.raw} disabled={!canEvaluate || busy || !save.ready || save.recovery != null} aria-invalid={item.raw !== "" && (Number(item.raw) < 0 || Number(item.raw) > item.max) || undefined}
            onChange={event => set({ scores: { ...draft.scores, [item.id]: event.target.value } })} />
          <span id={`grade-${item.id}-scale`} className="w-10 text-xs text-muted-foreground tabular-nums">/{item.max}</span>
        </span>
      </div>)}
    </div>
    {invalid && <p role="alert" className="text-control text-destructive">{invalid.label} must be between 0 and {invalid.max}.</p>}
    <div className="oc-review-overall-row">
      <div>
        <p className="text-xs text-muted-foreground">{draft.override ? "Overall (edited)" : rubric.categories.length > 1 ? "Overall · average of scored categories" : "Out of 10"}</p>
        {draft.override
          ? <span className="flex items-center gap-1"><Label htmlFor="grade-overall" className="sr-only">Overall score out of 10</Label><Input id="grade-overall" type="number" inputMode="decimal" min={1} max={10} step={0.1} className="oc-review-score-input" value={draft.overall} disabled={!canEvaluate || busy} onChange={event => set({ overall: event.target.value })} /><span className="text-xs text-muted-foreground">/10</span></span>
          : <p className="oc-review-overall"><span className="tabular-nums">{formatOverall(computed)}</span><span className="oc-review-overall-scale">/10</span></p>}
      </div>
      {canEvaluate && rubric.categories.length > 1 && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => set(draft.override ? { override: false } : { override: true, overall: computed === null ? "" : String(computed) })}>{draft.override ? "Use average" : "Edit"}</Button>}
    </div>
    {stored !== null && overall !== null && Math.abs(stored - overall) > 0.001 && <p className="text-xs text-muted-foreground">Ratings record this as {stored.toFixed(1)} (scores are kept in half points from 1 to 10).</p>}
    {overallInvalid && <p role="alert" className="text-control text-destructive">Enter an overall score from 0 to 10.</p>}
    <Label htmlFor="grade-notes" className="text-xs text-muted-foreground">Comment (optional)</Label>
    <Textarea id="grade-notes" rows={3} className="min-h-20 resize-y" value={draft.notes} disabled={!canEvaluate || busy || !save.ready || save.recovery != null} onChange={event => set({ notes: event.target.value })} />
    {canEvaluate && <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={!ready} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit grade"}</Button>
      <span className="text-xs text-muted-foreground">Updates the Rating column. Submitted grades can’t be changed.</span>
    </div>}
    {message && <p role="status" className="text-xs">{message}</p>}
  </section>
}
