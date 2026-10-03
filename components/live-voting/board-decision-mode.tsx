"use client"
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"

import { DemoRoundTarget } from "@/components/demo-workspace"
import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Presentation, X } from "lucide-react"
import type { AppStatus } from "@prisma/client"
import type { getClubPipeline } from "@/lib/workspace-api"
import { setApplicationStatus } from "@/lib/workspace-api"
import { boardDecisionProgress } from "@/lib/board-review"
import { applicationStatusLabels } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import "./voting-mode.css"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
type Candidate = Pipeline["applications"][number]
export function BoardDecisionMode({
  applicants,
  rounds,
  clubId,
  clubName,
  canDecide,
  onDecision,
}: {
  applicants: Candidate[]
  rounds: Pipeline["rounds"]
  clubId: string
  clubName: string
  canDecide: boolean
  onDecision: (id: string, status: AppStatus) => void
}) {
  const [pool, setPool] = useState<Candidate[] | null>(null)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!applicants.length}
        onClick={() =>
          setPool(structuredClone(applicants.filter((app) => app.status !== "DRAFTING")))
        }
      >
        <Presentation className="size-4" />
        Board decision review
      </Button>
      <Dialog
        open={!!pool}
        onOpenChange={(value) => {
          if (!value) setPool(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="inset-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-background p-0 sm:max-w-none"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="oc-modal-title sr-only">Board decision review</DialogTitle>
          {pool && (
            <DecisionPresentation
              key={clubId}
              initial={pool}
              rounds={rounds}
              clubId={clubId}
              clubName={clubName}
              canDecide={canDecide}
              onClose={() => setPool(null)}
              onDecision={onDecision}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DecisionPresentation({
  initial,
  rounds,
  clubId,
  clubName,
  canDecide,
  onClose,
  onDecision,
}: {
  initial: Candidate[]
  rounds: Pipeline["rounds"]
  clubId: string
  clubName: string
  canDecide: boolean
  onClose: () => void
  onDecision: (id: string, status: AppStatus) => void
}) {
  const [pool, setPool] = useState(initial)
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<"ACCEPTED" | "REJECTED" | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const app = pool[index]
  const progress = boardDecisionProgress(pool)
  if (!app)
    return (
      <div className="space-y-4 p-8">
        <p>No submitted candidates in this selection.</p>
        <Button onClick={onClose}>Return to applicants</Button>
      </div>
    )
  const profile = app.student.studentProfile
  const name = profile ? `${profile.firstName} ${profile.lastName}` : app.student.email
  function navigate(next: number) {
    if (busy) return
    setIndex(next)
    setMessage("")
    setFailed(false)
    requestAnimationFrame(() => heading.current?.focus())
  }
  async function confirm() {
    if (!choice || busy || !canDecide) return
    setBusy(true)
    setMessage("")
    setFailed(false)
    try {
      await setApplicationStatus({
        clubId,
        applicationId: app.id,
        status: choice,
        expectedStatus: app.status === "DRAFTING" ? undefined : app.status,
      })
      setPool((previous) =>
        previous.map((item) => (item.id === app.id ? { ...item, status: choice } : item)),
      )
      onDecision(app.id, choice)
      setChoice(null)
      setMessage(`${name}: ${choice === "ACCEPTED" ? "accepted" : "not selected"}. Decision saved.`)
      if (index < pool.length - 1) {
        setIndex(index + 1)
        requestAnimationFrame(() => heading.current?.focus())
      }
    } catch {
      setFailed(true)
      setMessage(
        "The decision could not be saved. It may have changed elsewhere. Close board review, refresh the applicant list, and try again.",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-10">
        <div>
          <p className="text-sm font-semibold">
            OutClass <span className="px-2 text-muted-foreground">/</span> Board decision review
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{clubName} · Board decision review</p>
        </div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
          <X className="size-4" />
          Return to applicants
        </Button>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-6 sm:px-10 sm:py-8">
        <DemoRoundTarget />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            Candidate {index + 1} of {pool.length} · Current filtered selection
          </p>
          <p>Facilitated discussion · individual ballots are not collected</p>
        </div>
        <p
          role={failed ? "alert" : "status"}
          className={
            message && !choice
              ? `text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`
              : "sr-only"
          }
        >
          {!choice ? message : ""}
        </p>
        <article key={app.id} className="oc-voting-candidate space-y-7">
<h2
  ref={heading}
  tabIndex={-1}
  className="font-display text-2xl"
>
  Candidate {index + 1}
</h2>
<ApplicantDisplayPanel
  key={app.id}
  clubId={clubId}
  applicationId={app.id}
  mode="voting"
/> 98cfd3c (Prompt 33)
        </article>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Button
            variant="ghost"
            disabled={busy || index === 0}
            onClick={() => navigate(index - 1)}
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>
          {canDecide ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-12 min-w-36"
                disabled={busy || app.status === "REJECTED"}
                onClick={() => {
                  setMessage("")
                  setChoice("REJECTED")
                }}
              >
                <X className="size-4" />
                Not selected
              </Button>
              <Button
                className="min-h-12 min-w-36"
                disabled={busy || app.status === "ACCEPTED"}
                onClick={() => {
                  setMessage("")
                  setChoice("ACCEPTED")
                }}
              >
                <Check className="size-4" />
                Accept
              </Button>
            </div>
          ) : (
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              Presentation only. Decision-management permission is required to record final decisions.
            </p>
          )}
          <Button
            variant="ghost"
            disabled={busy || index === pool.length - 1}
            onClick={() => navigate(index + 1)}
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="text-center text-xs leading-6 text-muted-foreground">
          Final decisions update the student’s application after confirmation. No automatic email is
          sent.
        </p>
      </div>
      <footer className="border-t border-border bg-card px-5 py-4 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            <strong className="tabular-nums">{progress.accepted}</strong> accepted{" "}
            <span className="mx-2 text-muted-foreground">·</span>
            <strong className="tabular-nums">{progress.rejected}</strong> not selected
          </p>
          <p className="text-muted-foreground">
            {progress.remaining} without a final decision in this selection
          </p>
        </div>
      </footer>
      <Dialog
        open={!!choice}
        onOpenChange={(value) => {
          if (!value && !busy) setChoice(null)
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {choice === "ACCEPTED" ? `Accept ${name}?` : `Mark ${name} as not selected?`}
            </DialogTitle>
            <DialogDescription>
              This saves a final application decision visible to the student. Current status:{" "}
              {applicationStatusLabels[app.status]}.{" "}
              {index < pool.length - 1
                ? "After saving, the next candidate will appear."
                : "This is the final candidate in your selection."}
            </DialogDescription>
          </DialogHeader>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setChoice(null)}>
              Keep discussing
            </Button>
            <Button disabled={busy} onClick={() => void confirm()}>
              {busy
                ? "Saving decision…"
                : index < pool.length - 1
                  ? "Confirm & next"
                  : "Confirm decision"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
