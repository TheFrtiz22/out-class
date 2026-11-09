import { decisionCountLabels, summaryScopeLabels, type BandCounts, type TargetSummary } from "@/lib/voting-target-summary"
import { rankedBandLabels, rankedBandOrder } from "@/lib/ranked-review"
import "./voting-target-summary.css"

/** Round-wide summaries add how many rooms were counted and whether any were not visible. */
export type ScopedTargetSummary = TargetSummary & { sessions?: number; partial?: boolean }

function Figure({ label, value, band }: { label: string; value: number | string; band?: string }) {
  return <div className="oc-target-figure" data-band={band}><dt>{label}</dt><dd>{value}</dd></div>
}

/** The configured target, with real numbers in text; the bar caps at 100% but never hides overage. */
export function TargetFigure({ summary }: { summary: ScopedTargetSummary }) {
  const { target, progress } = summary
  return <div className="oc-target-line" data-over={progress.over > 0 || undefined}>
    <span className="oc-target-label">{target.label}</span>
    <span className="oc-target-value">{target.value === null ? "No target set" : target.value}</span>
    {target.value !== null && <>
      <span className="oc-target-progress">{progress.text}{progress.detail && <> · <strong>{progress.detail}</strong></>}</span>
      <span className="oc-target-bar" aria-hidden="true"><span style={{ width: `${progress.percent ?? 0}%` }} /></span>
    </>}
    {target.note && <span className="oc-target-note">{target.note}</span>}
  </div>
}

/** Recorded outcomes only, each applicant once. Never ballots. */
export function DecisionFigures({ summary }: { summary: ScopedTargetSummary }) {
  const d = summary.decisions
  return <div className="oc-target-group" data-scope={summary.scope}>
    <p className="oc-target-heading">Decisions · {summaryScopeLabels[summary.scope]}{summary.scope === "round" && summary.sessions !== undefined ? <span className="oc-target-sub"> · {summary.sessions} {summary.sessions === 1 ? "session" : "sessions"}</span> : null}</p>
    <dl className="oc-target-figures">
      <Figure label={decisionCountLabels.pass} value={d.pass} />
      <Figure label={decisionCountLabels.hold} value={d.hold} />
      <Figure label={decisionCountLabels.notPass} value={d.notPass} />
      <Figure label={decisionCountLabels.unreviewed} value={d.unreviewed} />
    </dl>
    {summary.partial && <p className="oc-target-note">Includes only voting sessions you can open.</p>}
  </div>
}

/** Discussion groups are not decisions. "Score not available" is shown apart from Not scored. */
export function BandFigures({ bands }: { bands: BandCounts }) {
  return <div className="oc-target-group" data-scope="round">
    <p className="oc-target-heading">Discussion groups · {summaryScopeLabels.round}</p>
    <dl className="oc-target-figures">
      {bands.bandsSet ? rankedBandOrder.map(b => <Figure key={b} label={rankedBandLabels[b]} value={bands[b]} band={b} />) : <Figure label="Scored, no bands set" value={bands.scored} />}
      <Figure label="Not scored" value={bands.notScored} />
      {bands.hidden > 0 && <Figure label="Score not available" value={bands.hidden} />}
    </dl>
  </div>
}

/**
 * Compact target-and-counts summary. Target, discussion groups and decisions
 * are labelled separately and each scope is named; nothing here limits voting.
 */
export function VotingTargetSummary({ label, target, session, round, bands, roundStatus, targetFallback = "No target set" }: {
  label: string
  /** The summary whose target is shown (session scope in a room, round scope in review). */
  target: ScopedTargetSummary | null
  session?: ScopedTargetSummary | null
  round?: ScopedTargetSummary | null
  bands?: BandCounts | null
  /** Shown in place of round decision counts when they are loading or unavailable. */
  roundStatus?: string
  /** Shown when no summary is loaded yet; never implies that zero is a target. */
  targetFallback?: string
}) {
  return <section className="oc-target-summary" aria-label={label}>
    {target ? <TargetFigure summary={target} /> : <div className="oc-target-line"><span className="oc-target-label">Target</span><span className="oc-target-value">{targetFallback}</span></div>}
    <p className="oc-target-note">Guidance only. Reaching the target does not stop voting or reject anyone.</p>
    <div className="oc-target-groups">
      {bands && <BandFigures bands={bands} />}
      {session && <DecisionFigures summary={session} />}
      {round ? <DecisionFigures summary={round} /> : roundStatus ? <div className="oc-target-group" data-scope="round"><p className="oc-target-heading">Decisions · {summaryScopeLabels.round}</p><p className="oc-target-note" role="status">{roundStatus}</p></div> : null}
    </div>
  </section>
}
