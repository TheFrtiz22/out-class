"use client"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect } from "@/components/ui/native-select"
import { StatusPill } from "@/components/ui/status-pill"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Linkedin, MoreHorizontal, Pause, X } from "@/components/icons"
import { PreviouslyAppliedBadge } from "@/components/previously-applied-badge"
import { ApplicantRecusal } from "@/components/applicant-recusal"
import { RevealApplicant } from "@/components/reveal-applicant"
import { RecruitmentAttendanceSummary } from "@/components/recruitment-attendance-summary"
import { ResumeViewerDialog } from "@/components/resume-viewer-dialog"
import { InterviewFeedbackPanel } from "@/components/interview-feedback"
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"
import { AdditionalObservations } from "@/components/additional-observations"
import { ApplicationCycleAssignment } from "@/components/recruitment-cycles"
import { ApplicantProfileFacts, applicantProfileFacts } from "@/components/views/leader-dashboard/applicant-profile-facts"
import { DisabledReason, ReviewSection } from "./review-primitives"
import { ReviewGrading } from "./review-grading"
import { usePipelineApplicant } from "@/hooks/use-pipeline-applicant"
import { useStagedDecisions, type StagedDecisions } from "@/hooks/use-staged-decisions"
import { announceDataChanged } from "@/hooks/use-revalidate"
import { moveApplicantRound, reconsiderRejectedApplication, revokeRecruitmentOffer } from "@/lib/workspace-api"
import { hasPermission } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import { applicantInterviewHref } from "@/lib/applicant-interview-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { answerText, applicationAttachmentUrl } from "@/lib/student-applications"
import { joinFacts } from "@/lib/join-facts"
import { profilePhotoSource } from "@/lib/profile-photo"
import { resolveRecruitingResumeUrl, safeProfileUrl } from "@/lib/student-profile"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"
import { schedulingDateTime, SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { slotTime } from "@/lib/interview-rooms"
import { defaultProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { defaultReviewRubric } from "@/lib/review-rubric"
import { advanceLabel, canStage, sentDecisionHint, stagedLabel, type StagedOutcome } from "@/lib/staged-decisions"
import type { ExtendedMembership } from "@/contexts/auth-context"
import { ReportContentButton } from "@/components/reports/report-content-button"

const decisionKeys: Record<string, StagedOutcome> = { a: "ADVANCE", h: "HOLD", r: "REJECT" }
const typing = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="slider"], iframe')

/**
 * The one applicant review: a full-screen view of one applicant at a time (profile and history on the left,
 * grading and decisions on the right). Used by Applicants (list, board, "Review applicants"), Decide › Review,
 * the dashboard's assigned reviews and Ranked review. Decisions are staged (useStagedDecisions), never sent here.
 * Keys: A advance · H hold · R reject · ←/→ previous/next · Esc close.
 */
export function ApplicantReviewFlow({ membership, ids, startId, title, staged: sharedStaged, onClose, onChanged, onNext }: {
  membership: ExtendedMembership; ids: readonly string[]; startId: string; title: string
  staged?: StagedDecisions | null; onClose: (lastId: string | null) => void; onChanged?: () => void; onNext?: () => void
}) {
  const clubId = membership.clubId
  const confirm = useConfirm()
  const [index, setIndex] = useState(() => Math.max(0, ids.indexOf(startId)))
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [panel, setPanel] = useState<"round" | "cycle" | "reconsider" | null>(null)
  const [targetRound, setTargetRound] = useState("")
  const [reason, setReason] = useState("")
  const [openSections, setOpenSections] = useState<string[]>([])
  const [finished, setFinished] = useState(false)
  const id = ids[index] ?? null
  // The queue can grow once the whole selection loads; keep the same applicant open when it does.
  const currentId = useRef(id); currentId.current = id ?? currentId.current
  useEffect(() => { const at = currentId.current ? ids.indexOf(currentId.current) : -1; if (at >= 0) setIndex(at) }, [ids])
  const detail = usePipelineApplicant(clubId, id, revision)
  // While a refresh of the same applicant loads (after a grade or an action), keep showing what was there.
  const last = useRef<{ app: NonNullable<typeof detail.application>; pipeline: NonNullable<typeof detail.pipeline> } | null>(null)
  if (detail.application && detail.pipeline) last.current = { app: detail.application, pipeline: detail.pipeline }
  const kept = !detail.application && !detail.error && last.current?.app.id === id ? last.current : null
  const app = detail.application ?? kept?.app ?? null
  const pipeline = detail.pipeline ?? kept?.pipeline ?? null
  const rounds = useMemo(() => pipeline?.rounds ?? [], [pipeline])
  const rubric = pipeline && "rubric" in pipeline && pipeline.rubric ? pipeline.rubric : defaultReviewRubric
  const profileFields = pipeline?.profileFields ?? defaultProfileFieldVisibility()
  const canDecide = hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify")
  const ownStaged = useStagedDecisions(clubId, { enabled: canDecide && !sharedStaged && rounds.length > 0, rounds })
  const staged = sharedStaged ?? (canDecide ? ownStaged : null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { setMessage(""); setPanel(null); setOpenSections([]); setFinished(false) }, [id])
  useEffect(() => { if (app) requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })) }, [app?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- focus once per applicant

  const anonymous = !!app?.studentId.startsWith("anonymous-")
  const displayName = (value: NonNullable<typeof app>) => profileFields.name || value.studentId.startsWith("anonymous-") ? value.student.studentProfile ? `${value.student.studentProfile.firstName} ${value.student.studentProfile.lastName}` : value.student.email : anonymousApplicantLabel(value.id)
  const current = app ? staged?.get(app.id) : undefined
  const decideReason = !canDecide ? "Deciding needs decision access." : !app ? "Loading applicant…" : app.studentId === membership.userId ? "You can’t decide your own application." : !canStage(app.status) ? sentDecisionHint(app.status, "review", app.recruitmentOffer?.status === "PENDING") : busy ? "Saving…" : ""
  const go = useCallback((direction: -1 | 1) => {
    setIndex(value => { const next = value + direction; if (next < 0) return value; if (next >= ids.length) { setFinished(true); return value } return next })
  }, [ids.length])
  const close = useCallback(() => onClose(id), [onClose, id])

  const decide = useCallback(async (outcome: StagedOutcome) => {
    if (!app || !staged || decideReason) return
    if (outcome === "HOLD" && app.status === "WAITLISTED") return
    setBusy(true)
    const ok = await staged.stage({ id: app.id, status: app.status, roundId: app.roundId }, outcome)
    setBusy(false)
    if (ok) { onChanged?.(); go(1) }
  }, [app, staged, decideReason, onChanged, go])

  // Keys work anywhere in the review except while typing, in a menu, or under another dialog.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {})
  keyRef.current = event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return
    if (document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]').length > 1) return
    const key = event.key.toLowerCase()
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1) }
    else if (event.key === "ArrowRight") { event.preventDefault(); go(1) }
    else if (!event.shiftKey && decisionKeys[key]) { event.preventDefault(); void decide(decisionKeys[key]) }
  }
  useEffect(() => { const listener = (event: KeyboardEvent) => keyRef.current(event); window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener) }, [])

  const refresh = () => { setRevision(value => value + 1); onChanged?.() }
  async function run(work: () => Promise<unknown>, success: string, failure: string) {
    setBusy(true); setMessage("")
    try { await work(); setMessage(success); setPanel(null); refresh(); announceDataChanged("applicants") } catch { setMessage(failure) } finally { setBusy(false) }
  }

  const canReview = hasPermission(membership, "applications.review")
  const canManage = hasPermission(membership, "recruitment.manage") && hasPermission(membership, "applicants.identify")
  const activeRound = app ? rounds.find(round => round.id === app.roundId) : undefined
  const profile = app?.student.studentProfile
  const resumeUrl = app && !anonymous && profileFields.resume ? resolveRecruitingResumeUrl(profile?.resumeUrl, clubId, app.id) : undefined
  const linkedinUrl = !anonymous && profileFields.linkedin ? safeProfileUrl(profile?.linkedinUrl) : undefined
  const observationsEligible = !!app && canReview && hasPermission(membership, "applicants.identify") && !anonymous && !!app.recruitmentCycleId && app.studentId !== membership.userId && !activeRound?.anonymousReview
  const evaluateReason = !app || app.canEvaluate ? "" : app.studentId === membership.userId ? "You can’t grade your own application." : "Grading needs a panel assignment for this round; recruiting leads assign panels in Interviews › Scheduling. Submitted grades are read-only."
  const interviewLinks = [...(interviewCapabilities(membership).readClosing ? [{ tool: "reviews" as const, label: "Submitted reviews" }] : []), ...(interviewCapabilities(membership).moderateResume && !anonymous ? [{ tool: "resumes" as const, label: "Résumé moderation" }] : [])]
  const toggle = (key: string) => (open: boolean) => setOpenSections(list => open ? [...list, key] : list.filter(item => item !== key))
  const facts = app ? joinFacts(profileFields.academicYear && profile?.academicYear, activeRound?.name, ...(profile ? applicantProfileFacts({ ...profile, academicYear: null }, profileFields) : []), profileFields.major && profile?.major) : ""

  return <Dialog open onOpenChange={open => { if (!open && !busy) close() }}>
    <DialogContent showCloseButton={false} className="oc-review-flow" aria-describedby="review-flow-progress" onOpenAutoFocus={event => event.preventDefault()}>
      <header className="oc-review-flow-bar">
        <div className="min-w-0">
          <DialogTitle className="oc-review-flow-title">{title}</DialogTitle>
          <DialogDescription id="review-flow-progress" className="text-xs text-muted-foreground tabular-nums">{ids.length ? `${Math.min(index + 1, ids.length)} of ${ids.length}` : "No applicants"}</DialogDescription>
        </div>
        <nav aria-label="Applicant navigation" className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous applicant" aria-keyshortcuts="ArrowLeft" disabled={index === 0} onClick={() => go(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Next applicant" aria-keyshortcuts="ArrowRight" disabled={index >= ids.length - 1 && finished} onClick={() => go(1)}><ChevronRight className="size-4" /></Button>
          {onNext && <Button variant="outline" size="sm" onClick={onNext}>Next assigned review</Button>}
          <Button variant="ghost" size="icon" aria-label="Close review" aria-keyshortcuts="Escape" onClick={close}><X className="size-4" /></Button>
        </nav>
      </header>
      {finished ? <div className="oc-review-flow-done" role="status">
        <h2 className="oc-section-heading">You’ve reached the end of this set</h2>
        <p className="text-sm text-muted-foreground">{staged ? "Decisions are saved for Decide › Send. Nothing has been sent to applicants." : "Your grades are saved."}</p>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setFinished(false)}>Back to last applicant</Button><Button onClick={close}>Close review</Button></div>
      </div> : !app ? <div className="oc-review-flow-done" role={detail.error ? "alert" : "status"}>
        <p className="text-sm text-muted-foreground">{detail.error ? "This applicant couldn’t be loaded. Your access may have changed, or they’re no longer in this set." : "Loading applicant…"}</p>
        {detail.error && <div className="flex gap-2"><Button variant="outline" onClick={detail.retry}>Retry</Button>{index < ids.length - 1 && <Button onClick={() => go(1)}>Skip to next</Button>}</div>}
      </div> : <div className="oc-review-flow-body">
        <main className="oc-review-flow-main" aria-labelledby="review-applicant-name">
          <header className="oc-review-applicant">
            {profileFields.photo && <Avatar className="size-12 shrink-0"><AvatarImage src={profilePhotoSource(profile?.headshotUrl)} alt="" /><AvatarFallback>{displayName(app).split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="review-applicant-name" ref={heading} tabIndex={-1} className="oc-review-applicant-name">{displayName(app)}</h2>
                <StatusPill status={app.status} />
                {current && <span className="oc-staged-chip" data-testid="staged-decision">Staged · {stagedLabel(current, rounds)}</span>}
              </div>
              <p className="text-sm text-muted-foreground">{anonymous ? "Anonymous review · identity and appointments withheld" : facts || "Academic profile not provided"}</p>
              {!anonymous && profile && <p className="text-xs text-muted-foreground"><RecruitmentAttendanceSummary compact clubId={clubId} applicationId={app.id} /></p>}
              {"priorApplications" in app && !!app.priorApplications?.length && <p className="text-xs"><PreviouslyAppliedBadge priors={app.priorApplications} detail /></p>}
              <ApplicantRecusal key={app.id} clubId={clubId} applicationId={app.id} anonymous={anonymous} onChanged={refresh} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {resumeUrl && <ResumeViewerDialog href={resumeUrl} name={displayName(app)} clubId={clubId} applicationId={app.id} trigger="Résumé" />}
              {linkedinUrl && <a className="oc-quick-icon-action" href={linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" title="LinkedIn"><Linkedin size={16} aria-hidden="true" /></a>}
              {anonymous && hasPermission(membership, "applicants.identify") && <RevealApplicant canPrepare={hasPermission(membership, "recruitment.manage")} key={app.id} clubId={clubId} applicationId={app.id} />}
              <ReportContentButton target={{ type: "student", clubId, applicationId: app.id }} label="Report this profile" hidden={app.studentId === membership.userId || !canReview} ownerUserId={app.studentId} />
            </div>
          </header>

          <section aria-labelledby="review-responses" className="oc-review-block">
            <h3 id="review-responses" className="oc-review-panel-heading">Application</h3>
            {app.answers.map(answer => <div key={answer.id} className="oc-quick-answer">
              <h4>{answer.question.prompt}</h4>
              {answer.question.type === "FILE_UPLOAD" && applicationAttachmentUrl(answer.response, app.id, answer.questionId)
                ? <a className="text-sm underline" href={applicationAttachmentUrl(answer.response, app.id, answer.questionId)} target="_blank" rel="noopener noreferrer">Open attachment (new tab)</a>
                : <p className="whitespace-pre-wrap break-words">{answerText(answer.question, answer.response) || "No response"}</p>}
            </div>)}
            {!app.answers.length && <p className="text-sm text-muted-foreground">{anonymous ? "Responses and files are withheld during anonymous review." : "No club-specific responses."}</p>}
          </section>

          {profile && !anonymous && <section aria-labelledby="review-profile" className="oc-review-block">
            <h3 id="review-profile" className="oc-review-panel-heading">Profile</h3>
            <ApplicantProfileFacts profile={profile} fields={profileFields} />
          </section>}

          <div className="oc-quick-sections">
            {resumeUrl && <ReviewSection id={`flow-resume-${app.id}`} title="Résumé preview" open={openSections.includes("resume")} onOpenChange={toggle("resume")} lazy>
              <iframe key={app.id} title={`Résumé for ${displayName(app)}`} src={resumeUrl} referrerPolicy="no-referrer" className="h-[60dvh] min-h-80 w-full rounded-lg border bg-muted" />
            </ReviewSection>}
            {!anonymous && <ReviewSection id={`flow-interviews-${app.id}`} title="Interviews" count={app.bookings.length} open={openSections.includes("interviews")} onOpenChange={toggle("interviews")}>
              {app.bookings.length ? <ul className="divide-y">{app.bookings.map(booking => <li key={booking.id} className="py-2 text-sm"><p>{schedulingDateTime(booking.slot.startTime)} – {slotTime(booking.slot.endTime, SCHEDULING_TIMEZONE)}</p><p className="text-muted-foreground">{booking.slot.location || "Location not provided"}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No interview scheduled.</p>}
            </ReviewSection>}
            {canReview && !anonymous && <ReviewSection id={`flow-notes-${app.id}`} title="Interview notes" open={openSections.includes("notes")} onOpenChange={toggle("notes")}>
              <InterviewFeedbackPanel key={app.id} embedded clubId={clubId} applicationId={app.id} roundId={app.roundId} refreshKey={JSON.stringify(app.evaluations)} />
            </ReviewSection>}
            {canReview && <ReviewSection id={`flow-pros-${app.id}`} title="Pros/cons" open={openSections.includes("pros")} onOpenChange={toggle("pros")}>
              <ApplicantDisplayPanel key={app.id} embedded additionalObservations={false} clubId={clubId} applicationId={app.id} refreshKey={JSON.stringify(app.evaluations)} />
            </ReviewSection>}
            {observationsEligible && <ReviewSection id={`flow-observations-${app.id}`} title="Additional observations" open={openSections.includes("observations")} onOpenChange={toggle("observations")}>
              <SectionErrorBoundary label="observations"><AdditionalObservations key={app.id} clubId={clubId} applicationId={app.id} embedded /></SectionErrorBoundary>
            </ReviewSection>}
            {app.evaluations.length > 0 && <ReviewSection id={`flow-evaluations-${app.id}`} title="Reviews" count={app.evaluations.length} open={openSections.includes("evaluations")} onOpenChange={toggle("evaluations")}>
              <ul className="space-y-2">{app.evaluations.map(item => <li key={item.id} className="border-l-2 border-border pl-3 text-xs"><span className="font-medium">{item.round} · {item.score}/10</span>{item.interviewerId === membership.id ? " · You" : " · Club reviewer"}</li>)}</ul>
            </ReviewSection>}
          </div>
        </main>

        <aside className="oc-review-flow-aside" aria-label="Grade and decide">
          <ReviewGrading key={`${app.id}:${app.roundId}`} clubId={clubId} app={app} roundName={activeRound?.name ?? ""} rounds={rounds} rubric={rubric} memberId={membership.id} reason={evaluateReason} disabled={busy} onSubmitted={refresh} />
          {app.roundScore && <p className="text-xs text-muted-foreground">Rating {app.roundScore.average === null ? "—" : `${app.roundScore.average.toFixed(1)}/10`} · {app.roundScore.submitted}/{app.roundScore.required} reviews</p>}

          <section className="oc-review-decide" aria-labelledby="decide-heading">
            <div className="flex items-center justify-between gap-2">
              <h3 id="decide-heading" className="oc-review-panel-heading">Decision</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More applicant actions"><MoreHorizontal size={20} /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  {staged && canStage(app.status) && app.status !== "WAITLISTED" && <DropdownMenuItem disabled={!!decideReason} onSelect={() => void decide("WAITLIST")}>Waitlist</DropdownMenuItem>}
                  {staged && canStage(app.status) && <DropdownMenuItem disabled={!!decideReason} onSelect={() => void decide("ACCEPT")}>Accept</DropdownMenuItem>}
                  {current && <DropdownMenuItem disabled={busy} onSelect={() => void staged?.unstage({ id: app.id, status: app.status, roundId: app.roundId })}>Remove staged decision</DropdownMenuItem>}
                  {(staged && canStage(app.status) || current) && <DropdownMenuSeparator />}
                  {canManage && !["ACCEPTED", "REJECTED", "WAITLISTED"].includes(app.status) && <DropdownMenuItem onSelect={() => { setTargetRound(app.roundId); setPanel("round") }}>Move round now…</DropdownMenuItem>}
                  {canManage && !activeRound?.anonymousReview && <DropdownMenuItem onSelect={() => setPanel("cycle")}>Recruitment cycle…</DropdownMenuItem>}
                  {app.status === "REJECTED" && canDecide && <DropdownMenuItem onSelect={() => setPanel("reconsider")}>Reconsider application…</DropdownMenuItem>}
                  {app.status === "ACCEPTED" && app.recruitmentOffer?.status === "PENDING" && canDecide && <DropdownMenuItem disabled={busy} onSelect={async () => { if (!(await confirm({ title: "Rescind this pending offer?", description: "Accepted memberships are managed in member management.", confirmLabel: "Rescind offer", tone: "danger" }))) return; await run(() => revokeRecruitmentOffer(clubId, app.id), "Pending offer rescinded.", "Only pending offers can be rescinded.") }}>Rescind pending offer</DropdownMenuItem>}
                  {interviewLinks.map(item => <DropdownMenuItem key={item.tool} asChild><Link href={applicantInterviewHref(clubId, item.tool, "", app.id)} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>{item.label}</Link></DropdownMenuItem>)}
                  <DropdownMenuItem onSelect={refresh}>Reload applicant</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {current && <p className="text-xs text-muted-foreground" role="status">Staged: <strong className="font-medium text-foreground">{stagedLabel(current, rounds)}</strong> · {current.stagedByMe ? "by you" : `by ${current.stagedBy}`}. Sent from Decide › Send.</p>}
            <div className="oc-review-decision-buttons" role="group" aria-label="Decide">
              <DisabledReason reason={decideReason}><Button className="oc-review-decision" data-outcome="advance" aria-keyshortcuts="A" data-selected={current?.outcome === "ADVANCE" || current?.outcome === "ACCEPT" || undefined} onClick={() => void decide("ADVANCE")}><ArrowRight aria-hidden="true" />{advanceLabel(app, rounds)}<kbd>A</kbd></Button></DisabledReason>
              <DisabledReason reason={decideReason || (app.status === "WAITLISTED" ? "Already on hold (waitlisted)." : "")}><Button variant="outline" className="oc-review-decision" data-outcome="hold" aria-keyshortcuts="H" data-selected={current?.outcome === "HOLD" || undefined} onClick={() => void decide("HOLD")}><Pause aria-hidden="true" />Hold<kbd>H</kbd></Button></DisabledReason>
              <DisabledReason reason={decideReason}><Button variant="outline" className="oc-review-decision" data-outcome="reject" aria-keyshortcuts="R" data-selected={current?.outcome === "REJECT" || undefined} onClick={() => void decide("REJECT")}><X aria-hidden="true" />Reject<kbd>R</kbd></Button></DisabledReason>
            </div>
            {/* A, H and R show on the decision buttons themselves; the legend lists only the keys that have no button. */}
            <p className="oc-review-keys text-xs text-muted-foreground" aria-hidden="true"><kbd><ArrowLeft size={14} /></kbd><kbd><ArrowRight size={14} /></kbd> move · <kbd>Esc</kbd> close</p>
            <p className="text-xs text-muted-foreground">Decisions are saved, not sent. Send them from Decide › Send.</p>
            {message && <p role="status" className="text-xs">{message}</p>}
          </section>
        </aside>
      </div>}

      {app && <Dialog open={panel !== null} onOpenChange={value => { if (!value && !busy) setPanel(null) }}>
        <DialogContent>
          {panel === "round" && <><DialogHeader><DialogTitle>Move round now</DialogTitle><DialogDescription>{displayName(app)} · currently in {activeRound?.name ?? "an unavailable round"}. This moves them immediately; use Advance to stage it for Send instead.</DialogDescription></DialogHeader>
            <Label htmlFor="flow-move-round">Round</Label>
            <NativeSelect id="flow-move-round" disabled={busy} value={targetRound} onChange={event => setTargetRound(event.target.value)}>{rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</NativeSelect>
            <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPanel(null)}>Cancel</Button><Button disabled={busy || targetRound === app.roundId} onClick={() => void run(() => moveApplicantRound({ clubId, applicationId: app.id, newRoundId: targetRound, expectedRoundId: app.roundId }), "Round updated.", "This move couldn’t be saved. Reload and try again.")}>{busy ? "Moving…" : "Move round"}</Button></div></>}
          {panel === "cycle" && <><DialogHeader><DialogTitle>Recruitment cycle</DialogTitle><DialogDescription>{displayName(app)}</DialogDescription></DialogHeader>
            <ApplicationCycleAssignment key={app.id + app.recruitmentCycleId} clubId={clubId} applicationId={app.id} cycleId={app.recruitmentCycleId} onSaved={() => { setPanel(null); refresh() }} /></>}
          {panel === "reconsider" && <><DialogHeader><DialogTitle>Reconsider application</DialogTitle><DialogDescription>Returns {displayName(app)} to review. Earlier decisions stay in the history.</DialogDescription></DialogHeader>
            <Label htmlFor="flow-reconsider">Reason (at least 10 characters)</Label>
            <Textarea id="flow-reconsider" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
            <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPanel(null)}>Cancel</Button><Button disabled={busy || reason.trim().length < 10} onClick={() => void run(async () => { await reconsiderRejectedApplication({ clubId, applicationId: app.id, expectedGuard: app.publicationGuard, reason }); setReason("") }, "Application returned to review. Earlier decisions are preserved.", "Reconsideration failed. Check your access and try again.")}>{busy ? "Returning…" : "Reconsider"}</Button></div></>}
          {message && panel && <p role="status" className="text-sm">{message}</p>}
        </DialogContent>
      </Dialog>}
    </DialogContent>
  </Dialog>
}
