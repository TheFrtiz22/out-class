"use client"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { handleClubLink } from "@/lib/workspace-navigation"
import { getDashboardReviewQueue, type getClubWorkspaceOverview } from "@/lib/workspace-api"
import { hasPermission } from "@/lib/permissions"
import { memberDate } from "@/components/member-overview"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { Dashboard, DashboardCard, DashboardFoot, DashboardMore, DashboardQuiet, DateChipList, GlassRow, GlassRowList, MetricTiles, NeedsAction, NeedsYouRow, PipelineBars, type NeedsItem } from "@/components/product/dashboard/dashboard"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { TERMS } from "@/lib/copy/terms"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
const Review = dynamic(() => import("@/components/views/leader-dashboard/live-leader-workspace").then(m => m.ApplicantReviewPreview), { loading: () => <LoadingState variant="glass" layout="form" rows={3} label="Loading authorized review…" /> })
const Preparation = dynamic(() => import("@/components/interviews/dashboard-preparation").then(m => m.DashboardPreparation), { loading: () => <LoadingState variant="glass" label="Checking interview panel…" layout="rows" rows={2} /> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
/** Intake is closed when applications are switched off or the deadline has passed as of the overview read. */
export function applicationsClosed(op: Overview["operations"]) {
  const deadline = op.intake?.applicationDeadline
  return !op.intake?.applicationOpen || !!deadline && +new Date(deadline) <= +new Date(op.asOf)
}
export function RecruitingOverview({ data, refreshing = false, onChanged = () => {} }: { data: Overview; refreshing?: boolean; onChanged?: () => void }) {
  const { club, membership, operations: op } = data
  const [round, setRound] = useState(""), [applicant, setApplicant] = useState<string | null>(null), [booking, setBooking] = useState<Overview["operations"]["bookings"][number] | null>(null)
  const [reviewContext, setReviewContext] = useState(false)
  const [filteredQueue, setFilteredQueue] = useState<{ key: string; rows: Overview["operations"]["queue"]; error?: string } | null>(null), [retry, setRetry] = useState(0)
  const queueKey = `${round}:${+new Date(op.asOf)}:${retry}`
  useEffect(() => {
    if (!round) return
    let current = true
    getDashboardReviewQueue(club.id, round).then(rows => { if (current) setFilteredQueue({ key: queueKey, rows }) }).catch(() => { if (current) setFilteredQueue({ key: queueKey, rows: [], error: "This round’s review queue could not load." }) })
    return () => { current = false }
  }, [club.id, round, queueKey])
  const queue = round ? filteredQueue?.key === queueKey ? filteredQueue.rows : [] : op.queue, pending = op.rounds.reduce((n, r) => n + r.pending, 0), eligible = op.rounds.reduce((n, r) => n + r.eligible, 0)
  const base = `/club/${encodeURIComponent(club.id)}/workspace?section=recruitment`
  const now = +new Date(op.asOf), deadline = op.intake?.applicationDeadline
  const outcomes = data.recruitment?.filter(r => ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(r.status)) ?? []
  const hasOutcomes = outcomes.some(r => r.count > 0)
  const milestones = [
    ...(deadline && +new Date(deadline) > now && +new Date(deadline) <= now + 7 * 86400000 ? [{ id: "intake", title: "Applications close", at: deadline }] : []),
    ...op.scheduled.map(s => ({ id: s.id, title: s.kind === "DECISION" ? "Decisions scheduled to send" : "Communication scheduled", at: s.scheduledAt })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const canSchedule = hasPermission(membership, "interviews.manage")
  const toSchedule = canSchedule ? op.rounds.filter(r => r.needsBooking > 0) : []
  const scheduleHref = (roundId?: string) => `${base}&tool=interviews&interviewTab=schedule${roundId ? `&roundId=${roundId}` : ""}`
  const voteHref = (v: Overview["operations"]["votes"][number]) => !v.participants.length && !hasPermission(membership, "decisions.view") && !hasPermission(membership, "decisions.manage") ? `/voting/${v.id}/join` : `${base}&tool=applicants&voting=1&sessionId=${v.id}`
  const voteLabel = (v: Overview["operations"]["votes"][number]) => !v.participants.length && v.joinOpenedAt && !hasPermission(membership, "decisions.manage") ? "Join session" : TERMS.openSession
  const voteDone = (v: Overview["operations"]["votes"][number]) => v.state === "COMPLETE" || v.state === "COMPLETED"
  const openReview = (id: string) => { setReviewContext(true); setApplicant(id) }
  const roundName = round ? op.rounds.find(r => r.id === round)?.name : "All rounds"
  const roundPending = round ? op.rounds.find(r => r.id === round)?.pending ?? 0 : pending
  const needs: NeedsItem[] = []
  const liveVote = op.votes.find(v => !voteDone(v))
  if (liveVote) needs.push({ id: "vote", title: `Voting in ${liveVote.round.name}`, detail: `${liveVote.state.toLowerCase().replaceAll("_", " ")} session`, action: <NeedsAction href={voteHref(liveVote)}>{voteLabel(liveVote) === TERMS.openSession ? TERMS.openVoting : "Join session"}</NeedsAction> })
  if (pending > 0 && op.queue[0]) needs.push({ id: "reviews", title: `${pending} ${pending === 1 ? "review" : "reviews"} waiting for you`, detail: op.rounds.filter(r => r.pending > 0).map(r => r.name).join(" · "), progress: eligible ? { done: eligible - pending, total: eligible } : undefined, action: <NeedsAction onClick={() => openReview(op.queue[0]!.id)}>Start reviewing</NeedsAction> })
  if (toSchedule.length) { const n = toSchedule.reduce((sum, r) => sum + r.needsBooking, 0); needs.push({ id: "schedule", title: `${n} ${n === 1 ? "applicant needs" : "applicants need"} an interview time`, detail: toSchedule.map(r => r.name).join(" · "), action: <NeedsAction href={scheduleHref(toSchedule[0]!.id)}>{TERMS.scheduleInterviews}</NeedsAction> }) }
  const doneVote = op.votes.find(voteDone)
  if (doneVote) needs.push({ id: "decisions", title: `${doneVote.round.name} voting is complete`, detail: "Send decisions when you are ready.", action: <NeedsAction href={voteHref(doneVote)}>Review decisions</NeedsAction> })
  if (op.offers.length) needs.push({ id: "offers", title: `${op.offers.length} ${op.offers.length === 1 ? "offer" : "offers"} awaiting response`, detail: `Next expires ${memberDate(op.offers[0]!.expiresAt)}`, action: <NeedsAction onClick={() => { setReviewContext(false); setApplicant(op.offers[0]!.applicationId) }}>View offer</NeedsAction> })
  const needsItems = needs.slice(0, 4)
  const empty = (copy: ReactNode, action?: ReactNode) => <div className="oc-dashboard-state"><DashboardQuiet>{copy}</DashboardQuiet>{action}</div>

  return <Dashboard className="oc-command-center oc-command-recruiting" busy={refreshing}>
    {(op.cycles.length > 0 || !op.intake || deadline) && <p className="oc-recruiting-status oc-dashboard-note">
      {[...(op.cycles.length > 0 ? [op.cycles.map(c => c.name).join(" · ")] : []), ...(op.intake ? deadline ? [`Deadline ${memberDate(deadline)}`] : [] : ["Applicant summaries are unavailable with your access"])].join(" · ")}
    </p>}
    {!hasPermission(membership, "applicants.identify") && hasPermission(membership, "applications.review") && <p className="oc-command-footnote oc-dashboard-note">Anonymous rounds only. Identity, files and unapproved free text remain withheld.</p>}
    <NeedsYouRow headingId="dashboard-needs" items={needsItems} clear={<><strong>You’re clear for now.</strong> Reviews, interview times and decisions will show up here.</>} />
    <div className="oc-dashboard-grid"><div className="oc-dashboard-main">
      <DashboardCard id="dashboard-pipeline" title="Current pipeline" index={needsItems.length + 1} className="oc-pipeline-section">
        {op.rounds.length > 0 ? <>
          <SegmentedControl label="Filter review queue by round" className="oc-command-pipeline" size="compact" value={round}
            onChange={value => setRound(value === round ? "" : value)}
            options={[{ value: "", label: "All rounds" }, ...op.rounds.map(r => ({ value: r.id, label: r.name }))]} />
          <PipelineBars stages={op.rounds.map((r, i) => ({ id: r.id, label: `${String(i + 1).padStart(2, "0")} · ${r.name}`, count: r.count, tone: r.id === round ? "interview" : undefined }))} />
          <DashboardFoot>{op.rounds.reduce((n, r) => n + r.count, 0)} applicants · {pending} {pending === 1 ? "review" : "reviews"} remaining for you{toSchedule.length ? ` · ${toSchedule.reduce((n, r) => n + r.needsBooking, 0)} need interview times` : ""}</DashboardFoot>
        </> : empty(hasPermission(membership, "recruitment.manage") ? "No recruiting rounds yet." : "No rounds are available with your current review access.",
          hasPermission(membership, "recruitment.manage") ? <DashboardMore href={`${base}&tool=interviews`}>Set up recruitment</DashboardMore> : undefined)}
      </DashboardCard>
      <DashboardCard id="dashboard-reviews" headingTabIndex={-1} index={needsItems.length + 2} className="oc-review-console" aside={roundName}
        title={<>Your review queue <span className="oc-section-count oc-dashboard-count" aria-hidden="true">{roundPending}</span></>}
        more={{ href: `${base}&tool=applicants`, label: "All applicants", prefetch: false, onClick: event => handleClubLink(event as React.MouseEvent<HTMLAnchorElement>, `${base}&tool=applicants`) }}>
        <p className="oc-command-footnote oc-dashboard-note">Applicants waiting on your review</p>
        {round && filteredQueue?.key !== queueKey ? <LoadingState variant="glass" label="Loading this round’s reviews…" layout="rows" rows={3} />
          : round && filteredQueue?.error ? <div role="alert" className="oc-dashboard-state"><p>{filteredQueue.error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry reviews</Button></div>
          : queue.length ? <GlassRowList className="oc-review-records">{queue.map((a, index) => <li key={a.id}><GlassRow data-applicant-id={a.id} onClick={() => openReview(a.id)}
            lead={<span className="oc-record-number oc-dashboard-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>} title={a.label} detail={`${a.round} · ${a.anonymous ? "Anonymous review" : "Current panel assignment"}`} trailing={<span className="oc-dashboard-row-end">Review</span>} /></li>)}</GlassRowList>
          : empty(round ? "You have no reviews waiting in this round." : "You have no reviews waiting. You’re caught up on your assigned applicants.",
            round ? <DashboardMore onClick={() => setRound("")}>Show all rounds</DashboardMore> : <DashboardMore href={`/club/${encodeURIComponent(club.id)}/workspace?section=recruitment&tool=applicants`}>Browse all applicants</DashboardMore>)}
        {!round && pending > op.queue.length && <DashboardFoot>Showing the oldest {op.queue.length} of {pending} reviews. Saving a review brings the next candidate into this preview.</DashboardFoot>}
      </DashboardCard>
      {toSchedule.length > 0 && <DashboardCard id="dashboard-booking-followup" title="Interviews to schedule" index={needsItems.length + 3} className="oc-booking-priority">
        <GlassRowList>{toSchedule.map(r => <li key={r.id}><GlassRow title={`${r.needsBooking} ${r.needsBooking === 1 ? "applicant" : "applicants"} in ${r.name} ${r.needsBooking === 1 ? "needs" : "need"} an interview time.`}
          detail={r.bookingPaused ? "Booking is paused. Review the panel before resuming." : r.bookingPublishedAt ? "Booking is published. These active applicants do not have a reservation for this round." : "Publish the schedule to send them a booking link."}
          action={<Button variant="outline" asChild><Link href={scheduleHref(r.id)}>{TERMS.scheduleInterviews}</Link></Button>} /></li>)}</GlassRowList>
      </DashboardCard>}
      {(op.votes.length > 0 || hasOutcomes) && <DashboardCard id="dashboard-voting" title="Voting & decisions" index={needsItems.length + 4} className="oc-decision-summary">
        {hasOutcomes && <p className="oc-command-footnote oc-dashboard-note">Recorded outcomes · {outcomes.map(r => `${r.count} ${r.status === "ACCEPTED" ? "accepted" : r.status === "WAITLISTED" ? "waitlisted" : "not accepted"}`).join(" · ")}. These application outcomes are already visible to applicants; voting remains separate until explicitly published.</p>}
        {op.votes.length > 0 && <GlassRowList>{op.votes.map(v => <li key={v.id}><GlassRow title={v.round.name}
          detail={voteDone(v) ? "Voting complete · Send decisions when you are ready" : `${v.state.toLowerCase().replaceAll("_", " ")} session · continue in the voting workspace`}
          action={<Button variant={voteDone(v) ? "default" : "outline"} asChild><Link href={voteHref(v)}>{voteLabel(v)}</Link></Button>} /></li>)}</GlassRowList>}
      </DashboardCard>}
      {op.offers.length > 0 && <DashboardCard id="dashboard-offers" title="Offers awaiting response" aside="Next offers by expiry" index={needsItems.length + 5}>
        <GlassRowList>{op.offers.map(o => <li key={o.id}><GlassRow data-applicant-id={o.applicationId} onClick={() => { setReviewContext(false); setApplicant(o.applicationId) }}
          title={o.label} detail={`Pending membership offer · expires ${memberDate(o.expiresAt)}`} trailing={<span className="oc-dashboard-row-end">View offer</span>} /></li>)}</GlassRowList>
      </DashboardCard>}
    </div><div className="oc-dashboard-side">
      <DashboardCard id="dashboard-interviews" title="Interviews this week" index={needsItems.length + 2} className="oc-interview-agenda"
        more={canSchedule ? { href: scheduleHref(), label: TERMS.scheduleInterviews } : undefined} moreAt="foot">
        <DateChipList when={memberDate} items={op.bookings.map(b => ({ id: b.id, at: new Date(b.slot.startTime), kind: "interview", title: b.candidate, detail: `${b.round?.name ?? "Interview"} · ${b.slot.location} · Check panel & prepare`, onClick: () => setBooking(b) }))}
          empty={canSchedule ? "No interviews in the next 7 days." : "Ask an interview manager to schedule interviews. Your assigned rooms are in Interviews."} />
      </DashboardCard>
      {milestones.length > 0 && <DashboardCard id="dashboard-milestones" title="Next seven days" index={needsItems.length + 3} className="oc-milestone-agenda">
        <DateChipList when={memberDate} items={milestones.map(m => ({ id: m.id, at: new Date(m.at), kind: "deadline", title: m.title }))} empty="" />
      </DashboardCard>}
      {eligible > 0 && <DashboardCard id="dashboard-coverage" title="Your review coverage" index={needsItems.length + 4} className="oc-coverage-panel">
        <MetricTiles items={[{ label: "Finalized", value: eligible - pending, of: eligible }]} />
        <progress className="oc-dashboard-progress" value={eligible - pending} max={eligible} aria-label="Your completed reviews" />
      </DashboardCard>}
    </div></div>
    {applicant && <Review key={applicant} clubId={club.id} applicationId={applicant} onClose={() => setApplicant(null)} onChanged={onChanged} onNext={reviewContext && queue.some(a => a.id !== applicant) ? () => setApplicant(queue.find(a => a.id !== applicant)!.id) : undefined} />}
    {booking && <DashboardDrawer title="Prepare for interview" description="Current official panel validation and your authorized interview entry." onClose={() => setBooking(null)}><Preparation clubId={club.id} booking={booking} member={membership} /></DashboardDrawer>}
  </Dashboard>
}
