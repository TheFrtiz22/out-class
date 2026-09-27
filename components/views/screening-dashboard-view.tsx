"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { reviewMetrics, previewThresholds, type ReviewMetric, type ReviewThresholds } from "@/lib/review-rule-preview"

/** Local threshold editor; a future persistence adapter can consume ReviewThresholds. */
export function ScreeningDashboardView() {
  const [thresholds, setThresholds] = useState<ReviewThresholds>({})
  const [scores, setScores] = useState<ReviewThresholds>({})
  const results = previewThresholds(thresholds, scores)
  return <div className="max-w-lg space-y-6 py-6">
    <p role="note" className="border-l-2 border-brand-orange pl-3 text-sm text-muted-foreground">Local preview only. Rules are not saved or applied to applicants. No statuses change and no messages are sent.</p>
    <fieldset className="space-y-4"><legend className="mb-3 font-medium">Minimum thresholds</legend>
      {(Object.keys(reviewMetrics) as ReviewMetric[]).map(metric => {
        const spec = reviewMetrics[metric], enabled = thresholds[metric] !== undefined
        return <div key={metric} className="flex min-h-11 items-center justify-between gap-4">
          <label className="flex items-center gap-3"><input type="checkbox" checked={enabled} onChange={e => setThresholds(current => { const next = { ...current }; if (e.target.checked) next[metric] = spec.min; else delete next[metric]; return next })} />{spec.label}</label>
          <input aria-label={`Minimum ${spec.label}`} type="number" min={spec.min} max={spec.max} step={spec.step} disabled={!enabled} value={enabled ? (Number.isNaN(thresholds[metric]) ? "" : thresholds[metric]) : ""} onChange={e => setThresholds(current => ({ ...current, [metric]: e.target.valueAsNumber }))} className="min-h-11 w-28 rounded-md border bg-background px-3 disabled:opacity-40" />
        </div>
      })}
    </fieldset>
    <details className="border-t pt-4"><summary className="min-h-11 cursor-pointer text-sm font-medium">Try sample scores</summary>
      <p className="mb-4 text-sm text-muted-foreground">Enter hypothetical scores to preview each threshold separately. Missing scores are not evaluated; SAT and ACT are not converted or combined into a decision.</p>
      <div className="space-y-3">{(Object.keys(reviewMetrics) as ReviewMetric[]).map(metric => { const spec = reviewMetrics[metric]; return <label key={metric} className="flex items-center justify-between gap-4 text-sm">Sample {spec.label}<input type="number" min={spec.min} max={spec.max} step={spec.step} value={scores[metric] ?? ""} onChange={e => setScores(current => ({ ...current, [metric]: e.target.value === "" ? undefined : e.target.valueAsNumber }))} className="min-h-11 w-28 rounded-md border bg-background px-3" /></label> })}</div>
      <ul aria-live="polite" className="mt-4 space-y-2 text-sm">{results.map(({ metric, result }) => <li key={metric}>{reviewMetrics[metric].label}: {result === "below" ? "Below preview threshold" : result === "meets" ? "Meets preview threshold" : result === "missing" ? "No sample score · not evaluated" : "Enter a valid threshold and sample score"}</li>)}</ul>
      {!results.length && <p className="mt-4 text-sm text-muted-foreground">Enable a threshold to preview it.</p>}
    </details>
    <Button variant="outline" onClick={() => { setThresholds({}); setScores({}) }}>Clear preview</Button>
    <p className="text-xs text-muted-foreground">Closing this tool clears the preview. Required tests are configured separately under Anonymous Review.</p>
  </div>
}
