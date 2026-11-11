"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { overviewSendCounts, overviewSessionAction, overviewSessionGroup, type DecideStep } from "@/lib/decide";
import { getRoundTargetSummary, type listLiveVotingRooms } from "@/lib/voting-room-api";
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

function Figure({ label, value }: { label: string; value: number | string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="m-0 text-xl font-semibold tabular-nums">{value}</dd></div>;
}

function StepLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  return <Button type="button" variant="ghost" size="sm" onClick={onOpen}>{label}<ArrowRight aria-hidden="true" /></Button>;
}

/**
 * Decide → Overview for the selected round, read only. Each figure reuses an existing server read and its checks:
 * decisions and target from getRoundTargetSummary (canonical outcomes, each applicant once), sessions from the
 * Voting room list DecidePage already loaded, and letter templates from getDecisionTemplates (recruitment.manage).
 */
export function DecideOverview({ clubId, member, access, rows, failed, onRetry, roundId, cycleId, onOpen }: {
  clubId: string; member: ClubAccess; access: { canVote: boolean; canSend: boolean }
  rows: Rooms | null; failed: boolean; onRetry: () => void; roundId: string; cycleId?: string; onOpen: (step: DecideStep) => void
}) {
  const demo = useDemoMode(), canLetters = hasPermission(member, "recruitment.manage");
  // Round totals are keyed by club, cycle and round: another round's figures never show while this one loads.
  const scope = `${clubId}:${cycleId ?? ""}:${roundId}:${demo.isDemoEnabled}:${member.permissions?.join()}`;
  const [summary, setSummary] = useState<{ scope: string; value: ScopedTargetSummary | null } | null>(null), [summaryRetry, setSummaryRetry] = useState(0);
  useEffect(() => {
    if (!access.canVote || !roundId || !demo.ready) return;
    let current = true;
    getRoundTargetSummary({ clubId, roundId, ...(cycleId ? { cycleId } : {}) })
      .then(value => { if (current) setSummary({ scope, value }) })
      .catch(() => { if (current) setSummary({ scope, value: null }) });
    return () => { current = false };
  }, [scope, clubId, roundId, cycleId, access.canVote, demo.ready, summaryRetry]);
  const [letters, setLetters] = useState<{ key: string; value: Awaited<ReturnType<typeof getDecisionTemplates>> | null } | null>(null);
  const lettersKey = `${clubId}:${demo.isDemoEnabled}:${canLetters}`;
  useEffect(() => {
    if (!canLetters || !demo.ready) return;
    let current = true;
    getDecisionTemplates(clubId).then(value => { if (current) setLetters({ key: lettersKey, value }) }).catch(() => { if (current) setLetters({ key: lettersKey, value: null }) });
    return () => { current = false };
  }, [lettersKey, clubId, canLetters, demo.ready]);
  const round = summary?.scope === scope ? summary : null, templates = letters?.key === lettersKey ? letters : null;
  const sessions = rows?.filter(r => overviewSessionGroup(r)) ?? [];
  const send = rows ? overviewSendCounts(rows) : null;
  const customized = templates?.value ? decisionTypes.filter(type => templates.value!.templates[type]).length : 0;
  const roomsFailed = failed ? <div role="alert" className="space-y-2"><p className="text-sm">Voting sessions could not be loaded.</p><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div> : null;

  return <div className="grid gap-5">
    {access.canVote && <Panel as="section" aria-labelledby="decide-overview-decisions" className="oc-workspace-stack">
      <h2 id="decide-overview-decisions" className="oc-section-heading">Decisions</h2>
      {!roundId ? <p className="text-sm text-muted-foreground">Choose a round to see its decisions and target.</p>
        : !round ? <LoadingState label="Loading decisions…" layout="rows" rows={1} />
        : !round.value ? <div role="alert" className="space-y-2"><p className="text-sm">Decision totals are unavailable for this round.</p><Button variant="outline" size="sm" onClick={() => setSummaryRetry(n => n + 1)}>Retry</Button></div>
        : <>
          <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Applicants by outcome">
            <Figure label="Passed" value={round.value.decisions.pass} />
            <Figure label="Held" value={round.value.decisions.hold} />
            <Figure label="Not passed" value={round.value.decisions.notPass} />
            <Figure label="Undecided" value={round.value.decisions.unreviewed} />
          </dl>
          {round.value.partial && <p className="text-xs text-muted-foreground">Includes only voting sessions you can open.</p>}
          <VotingTargetSummary label="Round target" target={round.value} />
        </>}
    </Panel>}

    {access.canVote && <Panel as="section" aria-labelledby="decide-overview-sessions" className="oc-workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="decide-overview-sessions" className="oc-section-heading">Voting sessions</h2><StepLink label="Open Vote" onOpen={() => onOpen("voting")} /></div>
      {roomsFailed ?? (!rows ? <LoadingState label="Loading voting sessions…" layout="rows" rows={2} />
        : !sessions.length ? <p className="text-sm text-muted-foreground">No active or scheduled sessions.</p>
        : <ul className="divide-y border-y">{sessions.map(r => {
            const group = overviewSessionGroup(r), name = r.meeting?.name ?? r.roundName;
            const status = group === "scheduled" ? "Scheduled" : r.state === "PAUSED" ? "Paused" : "Open";
            return <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{status}</span>{group === "scheduled" && r.meeting?.plannedAt ? <> · {formatDateTime(r.meeting.plannedAt, { timeZone: r.meeting.timeZone })}</> : null} · {pluralize(r.applicantCount, "applicant")}</p></div>
              <Button asChild variant="outline" size="sm"><Link scroll={false} href={`${liveRoomPath(clubId, r.id, r.view, demo.isDemoEnabled)}&cycleId=${encodeURIComponent(r.cycleId ?? "")}&roundId=${encodeURIComponent(r.roundId)}`}>{overviewSessionAction(r)}<span className="sr-only"> · {name}</span></Link></Button>
            </li>;
          })}</ul>)}
    </Panel>}

    <Panel as="section" aria-labelledby="decide-overview-letters" className="oc-workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="decide-overview-letters" className="oc-section-heading">Decision letters</h2>{access.canSend && <StepLink label="Open Send" onOpen={() => onOpen("letters")} />}</div>
      {access.canVote && (roomsFailed ?? (!send ? <LoadingState label="Loading decisions to send…" layout="rows" rows={1} />
        : <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Ready to send" value={send.ready.applicants} />
          <Figure label="Sent" value={send.sent.applicants} />
        </dl>))}
      {access.canVote && send && <p className="text-xs text-muted-foreground">Applicants in closed voting sessions: {pluralize(send.ready.sessions, "session")} ready, {pluralize(send.sent.sessions, "session")} sent.</p>}
      {canLetters && (!templates ? <LoadingState label="Loading letter templates…" layout="rows" rows={1} />
        : !templates.value ? <p role="status" className="text-sm text-muted-foreground">Letter templates could not be loaded.</p>
        : <p className="text-sm"><span className="font-medium">{customized} of {decisionTypes.length}</span> outcome letters customized · Formal letters {templates.value.sendFormalDecisionLetters ? "on" : "off"}</p>)}
    </Panel>
  </div>;
}
