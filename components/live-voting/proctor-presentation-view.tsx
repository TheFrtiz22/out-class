"use client"

import "./voting-mode.css"
import { useState } from "react"
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Monitor, Smartphone, X } from "lucide-react"
import { type VotingSession, applicantTally, votingProgress } from "@/lib/live-voting"
import { useProctorSession } from "@/lib/use-live-voting"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { VotingLobby } from "./voting-lobby"
import { MemberVotingPad } from "./member-voting-pad"

export function ProctorPresentationView({
  initialSession,
  onClose,
}: {
  initialSession: VotingSession
  onClose: () => void
}) {
  const { session, dispatch } = useProctorSession(initialSession)
  const [preview, setPreview] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [notice, setNotice] = useState("")
  const applicant = session.applicants[session.activeIndex]
  const progress = votingProgress(session)
  const tally = applicantTally(session, applicant.id)
  const memberPath = `/vote/?session=${encodeURIComponent(session.id)}`
  const ended = session.status === "ended"
  const stateLabel = {
    passed: "Pass majority",
    "no-pass": "No Pass majority",
    pending: "Voting open",
    tied: "Tied · no decision",
  }[tally.result]
  return (
    <section
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background font-sans text-foreground"
      aria-label="Live voting presentation"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <Monitor className="size-5" />
          <div>
            <h1 className="font-semibold">Voting preview</h1>
            <p className="text-xs text-neutral-500">
              {ended
                ? "Session complete"
                : session.status === "lobby"
                  ? "Waiting room"
                  : "Same-browser presentation"}{" "}
              · {session.memberCount} voting members
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="shadow-none"
            onClick={() => setPreview((value) => !value)}
            aria-pressed={preview}
          >
            <Smartphone className="size-4" />
            {preview ? "Hide" : "Preview"} voting pad
          </Button>
          <Button variant="outline" className="shadow-none" asChild>
            <a href={memberPath} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Open member tab
            </a>
          </Button>
          <Button
            variant="outline"
            className="shadow-none"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(new URL(memberPath, window.location.href).href)
                setNotice("Member link copied. Open it in this browser to try the simulation.")
              } catch {
                setNotice("Could not copy. Use Open member tab to access the voting pad.")
              }
            }}
          >
            <Copy className="size-4" />
            Copy link
          </Button>
          <Button
            variant="outline"
            className="shadow-none"
            onClick={() => (ended ? onClose() : setConfirmEnd(true))}
          >
            <X className="size-4" />
            {ended ? "Back to CRM" : "End session"}
          </Button>
        </div>
      </header>
      {notice && (
        <p role="status" className="px-5 pt-3 text-sm text-neutral-500 lg:px-10">
          {notice}
        </p>
      )}
      {session.status === "lobby" ? (
        <>
          <VotingLobby
            session={session}
            onBegin={() => dispatch({ type: "begin", now: Date.now() })}
          />
          {preview && (
            <aside aria-label="Member voting preview" className="mx-auto w-full max-w-md px-5 pb-8">
              <MemberVotingPad sessionId={session.id} embedded />
            </aside>
          )}
        </>
      ) : (
        <>
          <div
            className={`mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-7 px-5 py-8 lg:px-10 ${preview ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-500">
                  Applicant {session.activeIndex + 1} / {session.applicants.length}
                </span>
                <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs">
                  {ended ? "Final session results" : stateLabel}
                </span>
              </div>
              <article
                key={applicant.id}
                className="oc-voting-candidate space-y-7 border-y border-border py-7 md:py-9"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Avatar className="size-24 shrink-0 rounded-2xl border border-neutral-200 md:size-28">
                    <AvatarImage
                      src={applicant.headshotUrl}
                      alt={`${applicant.name} headshot`}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-2xl bg-neutral-50 text-4xl">
                      {applicant.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
                      Applicant profile
                    </p>
                    <h2 className="font-display text-3xl tracking-tight md:text-4xl">
                      {applicant.name}
                    </h2>
                    <p className="mt-3 text-neutral-500">
                      {applicant.year} · {applicant.major}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-5 border-y border-neutral-200 py-6">
                  <div>
                    <dt className="text-sm text-neutral-500">GPA</dt>
                    <dd className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                      {applicant.gpa || "—"}
                      <span className="ml-2 text-sm font-normal text-neutral-500">/ 4.0</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-neutral-500">SAT score</dt>
                    <dd className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                      {applicant.satScore || "—"}
                      <span className="ml-2 text-sm font-normal text-neutral-500">/ 1600</span>
                    </dd>
                  </div>
                </dl>
                <section className="border-b border-border pb-5">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                    Resume highlight
                  </h3>
                  <p className="mt-3 text-base leading-7">
                    {applicant.resumeHighlight || "No resume highlight added yet."}
                  </p>
                </section>
                <section>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-medium">Interview performance</h3>
                    <p className="text-sm text-neutral-500">
                      Cumulative score{" "}
                      <strong className="ml-2 text-lg font-semibold text-black tabular-nums">
                        {applicant.cumulativeScore
                          ? `${applicant.cumulativeScore.toFixed(1)} / 5`
                          : "Not scored"}
                      </strong>
                    </p>
                  </div>
                  {applicant.interviewScores?.length ? (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {applicant.interviewScores.map((round, index) => (
                        <div
                          key={`${round.round}-${index}`}
                          className="border-l-2 border-border pl-4"
                        >
                          <dt className="text-sm text-neutral-500">{round.round}</dt>
                          <dd className="mt-2 text-2xl font-semibold tabular-nums">
                            {round.score.toFixed(1)}{" "}
                            <span className="text-sm font-normal text-neutral-500">
                              / {round.maxScore}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      Individual round grades haven’t been recorded for this applicant.
                    </p>
                  )}
                </section>
              </article>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button
                  variant="outline"
                  className="h-11 shadow-none"
                  disabled={session.activeIndex === 0 || ended}
                  onClick={() => dispatch({ type: "navigate", index: session.activeIndex - 1 })}
                >
                  <ArrowLeft className="size-4" />
                  Previous Applicant
                </Button>
                <div className="text-center text-sm" aria-live="polite">
                  <p>
                    <strong>{tally.total}</strong> / {session.memberCount} votes ·{" "}
                    <span className="text-emerald-700">{tally.pass} Pass</span> ·{" "}
                    <span className="text-rose-700">{tally.noPass} No Pass</span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {tally.majority} votes required for a majority. Ties remain unresolved.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-11 shadow-none"
                  disabled={session.activeIndex === session.applicants.length - 1 || ended}
                  onClick={() => dispatch({ type: "navigate", index: session.activeIndex + 1 })}
                >
                  Next Applicant
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              <p className="text-xs leading-5 text-neutral-500">
                Simulation only. The proctor tab must stay open. Returning to an applicant preserves
                votes; a member cannot vote twice. Results do not change CRM application stages.
              </p>
            </div>
            {preview && (
              <aside aria-label="Member voting preview">
                <MemberVotingPad sessionId={session.id} embedded />
              </aside>
            )}
          </div>
          <footer className="sticky bottom-0 z-10 mt-auto space-y-3 border-t border-neutral-200 bg-white px-5 py-5 lg:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold tracking-tight tabular-nums">
                {progress.passed} Passed{" "}
                <span className="font-normal text-neutral-500">
                  / {progress.remaining} Remaining in Pool
                </span>
              </p>
              <p
                className={`text-sm ${progress.range === "above" ? "text-amber-800" : progress.range === "within" ? "text-emerald-800" : "text-neutral-500"}`}
              >
                Target {session.quota.min}–{session.quota.max} ·{" "}
                {progress.range === "above"
                  ? "Above target"
                  : progress.range === "within"
                    ? "Within target"
                    : "Below target"}
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="Passed applicants against target maximum"
              aria-valuemin={0}
              aria-valuemax={session.quota.max}
              aria-valuenow={Math.min(progress.passed, session.quota.max)}
              aria-valuetext={`${progress.passed} passed; target ${session.quota.min} to ${session.quota.max}`}
              className="relative h-1.5 overflow-hidden rounded-full bg-neutral-100"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${progress.range === "above" ? "bg-amber-600" : progress.range === "within" ? "bg-emerald-700" : "bg-neutral-900"}`}
                style={{ width: `${progress.percent}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 w-px bg-neutral-400"
                style={{ left: `calc(${(session.quota.min / session.quota.max) * 100}% - 1px)` }}
              />
            </div>
            <p className="text-xs text-neutral-500">
              {progress.noPass} No Pass · Remaining includes applicants with no majority and ties.
              Quota is guidance, not an automatic cutoff.
            </p>
          </footer>
        </>
      )}
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent className="border-neutral-200 bg-white font-sans shadow-none">
          <DialogHeader>
            <DialogTitle>End this voting session?</DialogTitle>
            <DialogDescription>
              {progress.remaining} applicants remain unresolved. Members will stop receiving new
              ballots. You can review the final totals before returning to the CRM; this simulation
              does not save results after you leave.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Keep voting
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: "end" })
                setConfirmEnd(false)
              }}
            >
              End voting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
