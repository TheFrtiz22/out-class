"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { handleClubLink } from "@/lib/workspace-navigation";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { overviewSessionAction, overviewSessionGroup, overviewSummaryState, type DecideStep, type OverviewSummaryState, type ScopedRead } from "@/lib/decide";
import { getRoundLetterCounts, getRoundTargetSummary, type listLiveVotingRooms } from "@/lib/voting-room-api";
import { getDecisionTemplates } from "@/lib/workspace-api";
import { decisionTypes } from "@/lib/decision-letters";
import { liveRoomPath } from "@/lib/voting-room";
import { formatDateTime, pluralize } from "@/lib/copy/terms";
import { VotingTargetSummary, type ScopedTargetSummary } from "@/components/voting-target-summary";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ArrowRight } from "@/components/icons";

type Rooms = Awaited<ReturnType<typeof listLiveVotingRooms>>;
type Templates = Awaited<ReturnType<typeof getDecisionTemplates>>;
type LetterCounts = Awaited<ReturnType<typeof getRoundLetterCounts>>;

function Figure({ label, sublabel, value }: { label: string; sublabel?: string; value: number | string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}{sublabel && <span className="block">{sublabel}</span>}</dt><dd className="m-0 text-xl font-semibold tabular-nums">{value}</dd></div>;
}

/** A real link to another Decide tab: the workspace's unsaved-work guard, then in-place club navigation. */
function StepLink({ label, href }: { label: string; href: string }) {
  return <Button asChild variant="ghost" size="sm"><Link href={href} scroll={false} onClick={event => { if (!canLeaveWorkspace()) { event.preventDefault(); return } handleClubLink(event, href) }}>{label}<ArrowRight aria-hidden="true" /></Link></Button>;
}

/** Decision totals for the round: outcomes counted once per applicant in its voting sessions, and the round target. */
export function DecisionTotals({ state, onRetry }: { state: OverviewSummaryState<ScopedTargetSummary>; onRetry: () => void }) {
  if (state.kind === "choose") return <p className="text-sm text-muted-foreground">Choose a round to see its decisions and target.</p>;
  if (state.kind === "loading") return <LoadingState label="Loading decisions…" layout="rows" rows={1} />;
  if (state.kind === "denied") return <p className="text-sm text-muted-foreground">Decision totals aren’t available with your access.</p>;
  if (state.kind === "failed") return <div role="alert" className="space-y-2"><p className="text-sm">Decision totals could not be loaded.</p><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>;
  const { value } = state;
  return <>
    <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Applicants by outcome">
      <Figure label="Passed" value={value.decisions.pass} />
      <Figure label="Held" value={value.decisions.hold} />
      <Figure label="Not passed" value={value.decisions.notPass} />
      <Figure label="Undecided" sublabel="in voting sessions" value={value.decisions.unreviewed} />
    </dl>
    {value.partial && <p className="text-xs text-muted-foreground">Includes only voting sessions you can open.</p>}
    <VotingTargetSummary label="Round target" target={value} />
  </>;
}

/** Re-runs a read when the window regains focus, as DecidePage's rooms read does. */
function useFocusReload() {
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const onFocus = () => setReload(n => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return [reload, () => setReload(n => n + 1)] as const;
}

/**
 * Decide → Overview for the selected round, read only. Each figure reuses an existing server read and its checks:
 * decisions and target from getRoundTargetSummary (canonical outcomes, each applicant once), sessions from the
 * Voting room list DecidePage already loaded, letters ready and sent per applicant from getRoundLetterCounts, and
 * letter templates from getDecisionTemplates (recruitment.manage).
 */
export function DecideOverview({ clubId, member, access, rows, failed, onRetry, roundId, cycleId, stepHref }: {
  clubId: string; member: ClubAccess; access: { canVote: boolean; canSend: boolean }
  rows: Rooms | null; failed: boolean; onRetry: () => void; roundId: string; cycleId?: string; stepHref: (step: DecideStep) => string
}) {
  const demo = useDemoMode(), canLetters = hasPermission(member, "recruitment.manage");
  // Each read is keyed by its scope: another round's figures never show while this one loads.
  const scope = `${clubId}:${cycleId ?? ""}:${roundId}:${demo.isDemoEnabled}:${member.permissions?.join()}`;
  const [summary, setSummary] = useState<ScopedRead<ScopedTargetSummary> | null>(null), [summaryReload, reloadSummary] = useFocusReload();
  useEffect(() => {
    if (!access.canVote || !roundId || !demo.ready) return;
    let current = true;
    getRoundTargetSummary({ clubId, roundId, ...(cycleId ? { cycleId } : {}) })
      .then(value => { if (current) setSummary({ scope, value }) })
      .catch(() => { if (current) setSummary({ scope, value: null }) });
    return () => { current = false };
  }, [scope, clubId, roundId, cycleId, access.canVote, demo.ready, summaryReload]);
  const lettersScope = `${clubId}:${demo.isDemoEnabled}:${canLetters}`;
  const [letters, setLetters] = useState<ScopedRead<Templates> | null>(null), [lettersReload] = useFocusReload();
  useEffect(() => {
    if (!canLetters || !demo.ready) return;
    let current = true;
    getDecisionTemplates(clubId).then(value => { if (current) setLetters({ scope: lettersScope, value }) }).catch(() => { if (current) setLetters({ scope: lettersScope, value: null }) });
    return () => { current = false };
  }, [lettersScope, clubId, canLetters, demo.ready, lettersReload]);
  // Letters for this round, each applicant once: ready to send and sent (the canonical delivery marker).
  const showSends = (access.canVote || access.canSend) && !!roundId;
  const [counts, setCounts] = useState<ScopedRead<LetterCounts> | null>(null), [countsReload, reloadCounts] = useFocusReload();
  useEffect(() => {
    if (!showSends || !demo.ready) return;
    let current = true;
    getRoundLetterCounts({ clubId, roundId, ...(cycleId ? { cycleId } : {}) })
      .then(value => { if (current) setCounts({ scope, value }) })
      .catch(() => { if (current) setCounts({ scope, value: null }) });
    return () => { current = false };
  }, [scope, clubId, roundId, cycleId, showSends, demo.ready, countsReload]);
  const canIdentify = hasPermission(member, "applicants.identify");
  const totals = overviewSummaryState({ roundId, scope, loaded: summary, canIdentify, rooms: rows });
  const letterCounts = overviewSummaryState({ roundId, scope, loaded: counts, canIdentify, rooms: rows });
  const templates = letters?.scope === lettersScope ? letters : null;
  const sessions = rows?.filter(r => overviewSessionGroup(r)) ?? [];
  const customized = templates?.value ? decisionTypes.filter(type => templates.value!.templates[type]).length : 0;
  const roomsFailed = failed ? <div role="alert" className="space-y-2"><p className="text-sm">Voting sessions could not be loaded.</p><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div> : null;

  return <div className="grid gap-5">
    {access.canVote && <Panel as="section" aria-labelledby="decide-overview-decisions" className="oc-workspace-stack">
      <h2 id="decide-overview-decisions" className="oc-section-heading">Decisions</h2>
      <DecisionTotals state={totals} onRetry={reloadSummary} />
    </Panel>}

    {access.canVote && <Panel as="section" aria-labelledby="decide-overview-sessions" className="oc-workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="decide-overview-sessions" className="oc-section-heading">Voting sessions</h2><StepLink label="Open Vote" href={stepHref("voting")} /></div>
      {roomsFailed ?? (!rows ? <LoadingState label="Loading voting sessions…" layout="rows" rows={2} />
        : !sessions.length ? <p className="text-sm text-muted-foreground">No sessions to run.</p>
        : <ul className="divide-y border-y">{sessions.map(r => {
            const group = overviewSessionGroup(r), name = r.meeting?.name ?? r.roundName;
            const status = group === "scheduled" ? "Scheduled" : group === "draft" ? "Not yet scheduled" : r.state === "PAUSED" ? "Paused" : "Open";
            return <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{status}</span>{group === "scheduled" && r.meeting?.plannedAt ? <> · {formatDateTime(r.meeting.plannedAt, { timeZone: r.meeting.timeZone })}</> : null} · {pluralize(r.applicantCount, "applicant")}</p></div>
              <Button asChild variant="outline" size="sm"><Link scroll={false} href={`${liveRoomPath(clubId, r.id, r.view, demo.isDemoEnabled)}&cycleId=${encodeURIComponent(r.cycleId ?? "")}&roundId=${encodeURIComponent(r.roundId)}`}>{overviewSessionAction(r)}<span className="sr-only"> · {name}</span></Link></Button>
            </li>;
          })}</ul>)}
    </Panel>}

    {(showSends || canLetters) ? <Panel as="section" aria-labelledby="decide-overview-letters" className="oc-workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="decide-overview-letters" className="oc-section-heading">Decision letters</h2>{access.canSend && <StepLink label="Open Send" href={stepHref("letters")} />}</div>
      {showSends && (letterCounts.kind === "loading" ? <LoadingState label="Loading decision letters…" layout="rows" rows={1} />
        : letterCounts.kind === "denied" ? <p className="text-sm text-muted-foreground">Letter counts aren’t available with your access.</p>
        : letterCounts.kind === "failed" ? <div role="alert" className="space-y-2"><p className="text-sm">Decision letters could not be loaded.</p><Button variant="outline" size="sm" onClick={reloadCounts}>Retry</Button></div>
        : letterCounts.kind === "ready" ? <dl className="m-0 grid grid-cols-2 gap-4 sm:max-w-sm" aria-label="Applicants by letter status"><Figure label="Ready to send" value={letterCounts.value.ready} /><Figure label="Sent" value={letterCounts.value.sent} /></dl> : null)}
      {canLetters && (!templates ? <LoadingState label="Loading letter templates…" layout="rows" rows={1} />
        : !templates.value ? <p role="status" className="text-sm text-muted-foreground">Letter templates could not be loaded.</p>
        : <p className="text-sm"><span className="font-medium">{customized} of {decisionTypes.length}</span> outcome letters customized · Formal letters {templates.value.sendFormalDecisionLetters ? "on" : "off"}</p>)}
    </Panel> : access.canSend ? <p><StepLink label="Open Send" href={stepHref("letters")} /></p> : null}
  </div>;
}
