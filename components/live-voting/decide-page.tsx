"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoMode } from "@/contexts/demo-context";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { canLeaveWorkspace, decideAccess } from "@/lib/product-navigation";
import { decisionsHref, legacyVotingHistoryHref } from "@/lib/voting-navigation";
import { decideCounts, decideSteps, decideTab, decideTabs, overviewDefaultRound, readyToSend, roundsFromRooms, type DecideStep, type DecideTab } from "@/lib/decide";
import { listLiveVotingRooms } from "@/lib/voting-room-api";
import { getWorkspaceRounds } from "@/lib/workspace-api";
import { liveRoomPath } from "@/lib/voting-room";
import { navigateWithinClub } from "@/lib/workspace-navigation";
import { pluralize } from "@/lib/copy/terms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { LoadingState } from "@/components/ui/loading-state";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { DecisionSchedules } from "@/components/decision-schedules";
import { DecideOverview } from "./decide-overview";
const VotingRoomLanding = dynamic(() => import("./room-landing").then(m => m.VotingRoomLanding), { loading: () => <WorkspaceLoading label="Loading voting sessions…" layout="rows" rows={3} /> });
const DecideReview = dynamic(() => import("@/components/views/leader-dashboard/live-leader-workspace").then(m => m.LiveLeaderWorkspace), { loading: () => <WorkspaceLoading label="Loading applicants needing a decision…" layout="applicants" rows={3} /> });
const StagedDecisionsPanel = dynamic(() => import("@/components/applicant-review/staged-decisions-panel").then(m => m.StagedDecisionsPanel), { loading: () => <LoadingState label="Loading saved decisions…" layout="rows" rows={2} /> });
const DecisionTemplateEditor = dynamic(() => import("@/components/communications/template-editor").then(m => m.DecisionTemplateEditor), { loading: () => <WorkspaceLoading label="Loading decision letters…" layout="form" rows={3} /> });

type Rooms = Awaited<ReturnType<typeof listLiveVotingRooms>>;

/**
 * Decide: pick a round, see its Overview (the default tab), then Review, Vote and Send as ordered steps. The round
 * lives in the URL (`roundId`), as does the tab (`decisionTab`). Each step reuses the existing screen: the shared
 * applicant review (decisions are saved, not sent), the Voting room, and Send (saved decisions, letters, scheduled
 * sends). Board sessions are read-only history (FE-27).
 */
export function DecidePage({ clubId, member }: { clubId: string; member: ClubAccess & { club?: { name?: string } } }) {
  const params = useSearchParams(), router = useRouter(), demo = useDemoMode();
  const access = decideAccess(member);
  const tab = decideTab(params.get("decisionTab"), access);
  const roundId = params.get("roundId") ?? "", cycleId = params.get("cycleId") ?? undefined;
  const canManageRounds = hasPermission(member, "recruitment.manage");
  // Rooms (counts and the ready-to-send list) need voting read access; the server filters them to this member.
  const identity = `${clubId}:${roundId}:${cycleId}:${demo.isDemoEnabled}:${member.permissions?.join()}`;
  const [rooms, setRooms] = useState<{ identity: string; rows: Rooms; failed?: boolean } | null>(null), [retry, setRetry] = useState(0);
  const [allRooms, setAllRooms] = useState<Rooms | null>(null);
  const [managedRounds, setManagedRounds] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    if (!access.canVote || !demo.ready) return;
    let current = true;
    listLiveVotingRooms({ clubId, ...(cycleId ? { cycleId } : {}), ...(roundId ? { roundId } : {}) })
      .then(rows => { if (current) setRooms({ identity, rows }) })
      .catch(() => { if (current) setRooms({ identity, rows: [], failed: true }) });
    const reload = () => setRetry(n => n + 1);
    window.addEventListener("focus", reload);
    return () => { current = false; window.removeEventListener("focus", reload) };
  }, [identity, access.canVote, demo.ready, retry]);
  // Round picker: the club's rounds for recruitment managers; otherwise the rounds this member has sessions in.
  useEffect(() => {
    if (!demo.ready) return;
    let current = true;
    if (canManageRounds) getWorkspaceRounds(clubId).then(rows => { if (current) setManagedRounds(rows.map(r => ({ id: r.id, name: r.name }))) }).catch(() => { if (current) setManagedRounds(null) });
    else if (access.canVote) listLiveVotingRooms({ clubId }).then(rows => { if (current) setAllRooms(rows) }).catch(() => { if (current) setAllRooms(null) });
    return () => { current = false };
  }, [clubId, canManageRounds, access.canVote, demo.ready]);
  const rows = rooms?.identity === identity ? rooms.rows : null, roomsFailed = !!rooms?.failed && rooms.identity === identity;
  const counts = rows ? decideCounts(rows) : null;
  const rounds = managedRounds ?? (allRooms ? roundsFromRooms(allRooms) : []);
  const search = params.toString();
  const go = (href: string, replace = false) => { if (!canLeaveWorkspace()) return; if (navigateWithinClub(href, replace)) return; if (replace) router.replace(href, { scroll: false }); else router.push(href, { scroll: false }) };
  const setRound = (value: string) => {
    const next = new URLSearchParams(search);
    // "All rounds" is an explicit empty roundId, so Overview never replaces that choice with a default round.
    next.set("roundId", value);
    // Pushed, not replaced: Back and Forward restore the round as well as the tab.
    go(`/club/${encodeURIComponent(clubId)}/workspace?${next}`);
  };
  // Overview opens on the current round when the URL names none: written into the URL (replace, so Back skips it).
  const needsDefault = tab === "overview" && !params.has("roundId");
  const roundsKnown = rounds.length > 0 && (!access.canVote || !!rows || roomsFailed);
  const defaultRound = needsDefault && roundsKnown ? overviewDefaultRound(rounds, rows) : null;
  useEffect(() => {
    if (!defaultRound) return;
    const next = new URLSearchParams(search);
    next.set("roundId", defaultRound);
    const href = `/club/${encodeURIComponent(clubId)}/workspace?${next}`;
    if (!navigateWithinClub(href, true)) router.replace(href, { scroll: false });
  }, [defaultRound, search, clubId, router]);
  if (!tab) return <p role="alert">Decide is unavailable with your current access.</p>;
  const label = (step: DecideStep) => {
    const count = counts?.[step];
    return count == null ? undefined : step === "voting" ? `${pluralize(count, "session")} to run` : `${pluralize(count, "applicant")} ready to send`;
  };
  return <div className="oc-decide space-y-5">
    {rounds.length > 0 && <SegmentedControl label="Round" className="oc-command-pipeline" size="compact" value={rounds.some(r => r.id === roundId) ? roundId : ""}
      onChange={setRound} options={[{ value: "", label: "All rounds" }, ...rounds.map(r => ({ value: r.id, label: r.name }))]} />}
    <Tabs value={tab} onValueChange={value => go(decisionsHref(clubId, value as DecideTab, search))}>
      <TabsList variant="segmented" aria-label="Decide steps" className="oc-decide-steps">
        {decideTabs.filter(item => decideTab(item.id, access) === item.id).map(item => {
          if (item.id === "overview") return <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>;
          const step = item.id, number = decideSteps.filter(s => decideTab(s.id, access) === s.id).findIndex(s => s.id === step) + 1;
          return <TabsTrigger key={step} value={step} aria-label={[`Step ${number}: ${item.label}`, label(step)].filter(Boolean).join(", ")}>
            <span className="oc-decide-step-number" aria-hidden="true">{number}</span>{item.label}{counts?.[step] != null && <span className="oc-segment-count" aria-hidden="true">{" · "}{counts[step]}</span>}
          </TabsTrigger>;
        })}
      </TabsList>
      <TabsContent value="overview" className="mt-5">{tab === "overview" && <DecideOverview clubId={clubId} member={member} access={access} rows={rows} failed={roomsFailed} onRetry={() => setRetry(n => n + 1)} roundId={roundId} cycleId={cycleId} stepHref={step => decisionsHref(clubId, step, search)} />}</TabsContent>
      {access.canDecide && <TabsContent value="review" className="mt-5">{tab === "review" && <DecideReview key={roundId} scoped decisionsOnly initialDecision="pending" />}</TabsContent>}
      {access.canVote && <TabsContent value="voting" className="mt-5">{tab === "voting" && <VotingRoomLanding clubId={clubId} />}</TabsContent>}
      {access.canSend && <TabsContent value="letters" className="mt-5 space-y-6">{tab === "letters" && access.canDecide && <StagedDecisionsPanel clubId={clubId} roundId={roundId || undefined} />}{tab === "letters" && <SendStep clubId={clubId} member={member} rows={rows} failed={roomsFailed} onRetry={() => setRetry(n => n + 1)} canVote={access.canVote} canScheduled={access.canScheduled} roundId={roundId} />}</TabsContent>}
    </Tabs>
  </div>;
}

/** Step 2: what is ready to send in this round, letters by outcome, individual decisions, and scheduled sends. */
function SendStep({ clubId, member, rows, failed, onRetry, canVote, canScheduled, roundId }: {
  clubId: string; member: ClubAccess & { club?: { name?: string } }; rows: Rooms | null; failed: boolean; onRetry: () => void
  canVote: boolean; canScheduled: boolean; roundId: string
}) {
  const demo = useDemoMode();
  const ready = rows?.filter(readyToSend) ?? [];
  const canLetters = hasPermission(member, "recruitment.manage");
  const applicants = `/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants&decision=pending${roundId ? `&roundId=${encodeURIComponent(roundId)}` : ""}`;
  return <>
    {canVote && <Panel as="section" aria-labelledby="decide-ready-heading" className="oc-workspace-stack">
      <h2 id="decide-ready-heading" className="oc-section-heading">Ready to send</h2>
      <p className="text-sm text-muted-foreground">Closed voting sessions whose outcomes haven’t been sent. Each one shows Accepted, Waitlisted and Not accepted counts before you send or schedule it.</p>
      {failed ? <div role="alert"><p>Voting sessions could not be loaded.</p><Button variant="outline" onClick={onRetry}>Retry</Button></div>
        : !rows ? <LoadingState label="Loading sessions ready to send…" layout="rows" rows={2} />
        : !ready.length ? <p className="text-sm text-muted-foreground">Nothing is waiting to send in this round.</p>
        : <ul className="divide-y border-y">{ready.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-medium">{r.meeting?.name ?? r.roundName}</p><p className="text-sm text-muted-foreground">{r.cycleName} · {r.roundName} · {pluralize(r.applicantCount, "applicant")}</p></div>
            <Button asChild variant="outline" size="sm"><Link scroll={false} href={r.mode === "LIVE" ? `${liveRoomPath(clubId, r.id, r.view, demo.isDemoEnabled)}&cycleId=${encodeURIComponent(r.cycleId ?? "")}&roundId=${encodeURIComponent(r.roundId)}` : legacyVotingHistoryHref(clubId, r.id, demo.isDemoEnabled)}>{r.mode === "LIVE" ? "Review and send" : "View history"}<span className="sr-only"> · {r.meeting?.name ?? r.roundName}</span></Link></Button>
          </li>)}</ul>}
    </Panel>}
    <Panel as="section" aria-labelledby="decide-letters-heading" className="oc-workspace-stack">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="decide-letters-heading" className="oc-section-heading">Decision letters</h2>
        <Button asChild variant="outline" size="sm"><Link href={applicants}>Open applicants</Link></Button></div>
      {canLetters ? <DecisionTemplateEditor clubId={clubId} inline /> : <p role="status" className="text-sm text-muted-foreground">Letter template editing requires recruitment management access.</p>}
    </Panel>
    {canScheduled && <DecisionSchedules clubId={clubId} />}
  </>;
}
