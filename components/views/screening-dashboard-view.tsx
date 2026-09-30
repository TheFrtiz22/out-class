"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useApplicationState } from "@/lib/application-state"
import { getRecruitingRules, saveRecruitingRule, previewRecruitingRule, applyRecruitingRuleFlags, getRecruitingRuleFlags, clearRecruitingRuleFlags } from "@/lib/workspace-api"
import { emptyRuleThresholds, type RulePreview, type RuleThresholds } from "@/lib/recruiting-rules"
import { testRequirementLabels } from "@/lib/test-scores"

type Rules = Awaited<ReturnType<typeof getRecruitingRules>>
type Round = Rules["rounds"][number]
export function ScreeningDashboardView({ clubId, onReview }: { clubId?: string; onReview?: () => void }) {
  const [data, setData] = useState<Rules | null>(null)
  const [roundId, setRoundId] = useState("")
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let current = true
    setData(null); setError(false)
    if (clubId) getRecruitingRules(clubId).then(value => {
      if (current) { setData(value); setRoundId(id => value.rounds.some(round => round.id === id) ? id : value.rounds[0]?.id ?? "") }
    }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [clubId, reload])
  if (!clubId) return <p className="py-6 text-sm text-muted-foreground">Open Review Tools in a managed club workspace to configure persisted recruiting rules.</p>
  if (error) return <div role="alert" className="py-6"><p>Rules could not be loaded. Check your access and try again.</p><Button onClick={() => setReload(n => n + 1)}>Retry</Button></div>
  if (!data) return <p role="status" className="py-6">Loading recruiting rules…</p>
  const round = data.rounds.find(round => round.id === roundId)
  return <div className="space-y-6 py-6">
    <p className="border-l-2 border-brand-orange pl-3 text-sm text-muted-foreground">Saved rules suggest candidates for rejection review. Only an explicit action applies flags. Application decisions never change here and no messages are sent.</p>
    <label className="block text-sm font-medium">Recruitment round<select aria-label="Rule round" className="mt-2 min-h-11 w-full rounded-md border bg-background px-3" value={roundId} onChange={event => {
      if (document.querySelector('[data-saving="true"]')) return
      if (document.querySelector('[data-rule-dirty="true"]') && !window.confirm("Discard unsaved rule changes?")) return
      setRoundId(event.target.value)
    }}>{data.rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
    {round ? <RuleEditor key={round.id + ":" + (round.screeningRule?.revision ?? 0)} clubId={clubId} round={round} data={data} onReview={onReview} onReload={() => setReload(n => n + 1)} onSaved={saved => setData(current => current && ({ ...current, rounds: current.rounds.map(item => item.id === round.id ? { ...item, screeningRule: saved } : item) }))} /> : <p>No recruitment rounds are available.</p>}
  </div>
}

function RuleEditor({ clubId, round, data, onSaved, onReload, onReview }: { clubId: string; round: Round; data: Rules; onSaved: (saved: NonNullable<Round["screeningRule"]>) => void; onReload: () => void; onReview?: () => void }) {
  const canPreview = data.canPreview && (round.anonymousReview || data.canIdentify)
  const source: RuleThresholds = round.screeningRule ? { minGpa: round.screeningRule.minGpa, minSat: round.screeningRule.minSat, minAct: round.screeningRule.minAct } : emptyRuleThresholds
  const [thresholds, setThresholds] = useState<RuleThresholds>(source)
  const [preview, setPreview] = useState<RulePreview | null>(null)
  const [flags, setFlags] = useState<Awaited<ReturnType<typeof getRecruitingRuleFlags>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const { focusLeader } = useApplicationState()
  const dirty = JSON.stringify(source) !== JSON.stringify(thresholds)
  const scope = { clubId, roundId: round.id }
  useEffect(() => {
    let current = true
    if (canPreview) getRecruitingRuleFlags({ clubId, roundId: round.id }).then(value => { if (current) setFlags(value) }).catch(() => { if (current) setError("Saved flags could not be loaded. Reload to try again.") })
    return () => { current = false }
  }, [clubId, round.id, canPreview])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy])
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setMessage(""); setError("")
    try { await action() } catch {
      setPreview(null)
      setError("Could not complete this action. Check the score ranges and test requirement. Rules, applicants, or access may have changed; reload and preview again.")
    } finally { setBusy(false) }
  }
  const matches = preview?.results.filter(result => result.outcome === "flag") ?? []
  const fields = [
    { key: "minGpa" as const, label: "GPA", min: 0, max: 4, step: 0.01 },
    ...(data.testRequirement !== "ACT" || thresholds.minSat !== null ? [{ key: "minSat" as const, label: "SAT", min: 400, max: 1600, step: 10 }] : []),
    ...(data.testRequirement !== "SAT" || thresholds.minAct !== null ? [{ key: "minAct" as const, label: "ACT", min: 1, max: 36, step: 1 }] : []),
  ]
  function review(id: string) { focusLeader({ clubId, applicantId: id, roundId: round.id }); onReview?.() }
  return <div className="space-y-6" data-rule-dirty={dirty} data-unsaved={dirty} data-saving={busy}>
    <p className="text-sm">{testRequirementLabels[data.testRequirement as keyof typeof testRequirementLabels]}</p>
    <form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await saveRecruitingRule({ ...scope, expectedRevision: round.screeningRule?.revision ?? 0, thresholds }); onSaved(saved) }) }} className="space-y-4">
      <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 font-medium">Minimum scores</legend>
        {fields.map(field => <label key={field.key} className="flex items-center justify-between gap-4 text-sm">{field.label}<input aria-label={`Minimum ${field.label}`} type="number" min={field.min} max={field.max} step={field.step} value={thresholds[field.key] ?? ""} onChange={event => { setThresholds(current => ({ ...current, [field.key]: event.target.value === "" ? null : event.target.valueAsNumber })); setPreview(null) }} className="min-h-11 w-28 rounded-md border bg-background px-3" /></label>)}
      </fieldset>
      <p className="text-xs text-muted-foreground">Blank means no threshold. Missing or invalid scores require manual review, never automatic failure. GPA is evaluated independently. SAT-only and ACT-only clubs use that test; Both evaluates each configured threshold. For SAT-or-ACT, set both test thresholds or neither. When both optional test thresholds are set, either qualifying score also suffices.</p>
      <p className="text-xs text-muted-foreground">Saving replaces this round’s configuration and clears its previous flags. It does not evaluate or change any applicant.</p>
      <Button type="submit" disabled={busy || (!dirty && !!round.screeningRule)}>Save rules</Button>
      {round.screeningRule && <p role="status" className="text-xs text-muted-foreground">Saved version {round.screeningRule.revision}</p>}
    </form>
    {error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved rule changes and reload?")) onReload() }}>Reload</Button></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <section className="space-y-4 border-t pt-5">
      <h3 className="font-medium">Preview current applicants</h3>
      <p className="text-sm text-muted-foreground">Only submitted, in-review, and interviewing applications in this round are evaluated. Drafts and existing decisions, including waitlists, are excluded. Labels stay pseudonymous here.</p>
      <Button variant="outline" disabled={busy || dirty || !round.screeningRule || !canPreview} onClick={() => void run(async () => { setPreview(await previewRecruitingRule(scope)) })}>Preview saved rules</Button>
      {!canPreview && <p className="text-sm text-muted-foreground">Applicant review permission is required; identified rounds also require identity access.</p>}
      {preview && <div className="space-y-4">
        <p role="status" className="text-sm">{preview.results.length} evaluated · {matches.length} suggested flags · {preview.results.filter(result => result.outcome === "manual").length} need manual review only.</p>
        <ul className="max-h-80 divide-y overflow-y-auto rounded border px-3">{preview.results.map(result => <li key={result.id} className="space-y-1 py-3 text-sm"><p className="font-medium">{result.label}</p><p>{result.outcome === "flag" ? result.reasons.join("; ") : result.outcome === "manual" ? "Manual review" : "No flag suggested"}</p>{result.missing.length > 0 && <p className="text-muted-foreground">Missing / invalid: {result.missing.join(", ")}. Not treated as failures.</p>}</li>)}</ul>
        <p className="text-xs text-muted-foreground">Applying replaces this round’s saved flags with this preview. Decisions remain unchanged. You can clear flags at any time.</p>
        <Button disabled={busy || !data.canApply} onClick={() => void run(async () => { const result = await applyRecruitingRuleFlags({ ...scope, fingerprint: preview.fingerprint }); setPreview(null); setFlags(await getRecruitingRuleFlags(scope)); setMessage(`${result.flagged} flags saved. No decisions changed.`) })}>Apply {matches.length} review flags</Button>
        {!data.canApply && <p className="text-sm text-muted-foreground">Decision-management permission is required to apply or clear flags.</p>}
      </div>}
    </section>
    {canPreview && <section className="space-y-3 border-t pt-5"><h3 className="font-medium">Saved review flags</h3><p className="text-xs text-muted-foreground">These are snapshots, not decisions. Preview again to account for updated scores. Applicants who leave this round or receive a decision are omitted.</p>
      {flags === null ? <p role="status">Loading saved flags…</p> : !flags.length ? <p className="text-sm text-muted-foreground">No active flags in this round.</p> : <><ul className="divide-y">{flags.map(flag => <li key={flag.applicationId} className="space-y-1 py-3 text-sm"><p className="font-medium">{flag.label}</p><p>{flag.reasons.join("; ")}</p><p className="text-xs text-muted-foreground">Version {flag.ruleRevision} · {new Date(flag.flaggedAt).toLocaleString()}</p>{onReview && <Button variant="outline" disabled={busy || dirty} onClick={() => review(flag.applicationId)}>Review applicant</Button>}</li>)}</ul><Button variant="outline" disabled={busy || !data.canApply || dirty} onClick={() => void run(async () => { await clearRecruitingRuleFlags(scope); setFlags([]); setPreview(null); setMessage("Flags cleared. Decisions are unchanged.") })}>Clear saved flags</Button></>}
    </section>}
  </div>
}
