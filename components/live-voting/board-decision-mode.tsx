"use client"

import { DemoRoundTarget } from "@/components/demo-workspace"
import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Presentation, X } from "lucide-react"
import type { AppStatus } from "@prisma/client"
import type { getClubPipeline } from "@/lib/workspace-api"
import { setApplicationStatus } from "@/lib/workspace-api"
import { boardDecisionProgress } from "@/lib/board-review"
import { safeProfileUrl, resolveResumeUrl } from "@/lib/student-profile"
import { applicationStatusLabels } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
        Voting mode
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
          <DialogTitle className="sr-only">Voting mode · board decision review</DialogTitle>
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
  const scores = rounds
    .map((round) => {
      const values = app.evaluations.filter((item) => item.round === round.name)
      return {
        round,
        count: values.length,
        score: values.length
          ? values.reduce((sum, value) => sum + value.score, 0) / values.length
          : null,
      }
    })
    .filter((item) => item.count > 0)
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
        "The decision could not be saved. It may have changed elsewhere. Close Voting Mode, refresh the applicant list, and try again.",
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
            OutClass <span className="px-2 text-muted-foreground">/</span> Voting mode
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
          <header className="flex flex-wrap items-center gap-5 sm:gap-7">
            <Avatar className="size-20 shrink-0 sm:size-28">
              <AvatarImage src={safeProfileUrl(profile?.headshotUrl)} alt="" />
              <AvatarFallback className="bg-secondary text-3xl text-primary">
                {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {rounds.find((round) => round.id === app.roundId)?.name || "Round not available"}
              </p>
              <h2
                ref={heading}
                tabIndex={-1}
                className="break-words font-display text-3xl tracking-tight focus-visible:outline-2 focus-visible:outline-ring sm:text-4xl"
              >
                {name}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {profile
                  ? `${profile.major} · Class of ${profile.gradYear}`
                  : "Academic profile not provided"}
              </p>
              <Badge variant="secondary" className="mt-3">
                {applicationStatusLabels[app.status]}
              </Badge>
            </div>
          </header>
          <div className="grid gap-8 border-y border-border py-7 md:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
            <section className="min-w-0 space-y-4">
              <h3 className="text-sm font-semibold">Profile & experience</h3>
              {profile?.bio && (
                <p className="whitespace-pre-wrap break-words text-sm leading-7">{profile.bio}</p>
              )}
              {profile?.experiences.slice(0, 3).map((item) => (
                <div key={item.id}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.subtitle} · {item.period}
                  </p>
                </div>
              ))}
              {!profile?.bio && !profile?.experiences.length && (
                <p className="text-sm text-muted-foreground">
                  No profile introduction or experience provided.
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                {[
                  { label: "View résumé", url: profile?.resumeUrl, resolver: resolveResumeUrl },
                  { label: "LinkedIn", url: profile?.linkedinUrl, resolver: safeProfileUrl, resolveResumeUrl },
                ].map(
                  ({ label, url, resolver }) =>
                    resolver(url) && (
                      <a
                        key={label}
                        href={resolver(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        {label}
                        <span className="sr-only"> (new tab)</span>
                      </a>
                    ),
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {profile?.gpa != null && `GPA ${profile.gpa} / 4.0`}
                {profile?.gpa != null && profile?.satScore != null && " · "}
                {profile?.satScore != null && `SAT ${profile.satScore}`}
              </p>
              {profile && profile.experiences.length > 3 && (
                <details className="text-sm">
                  <summary className="cursor-pointer py-2">
                    More experience ({profile.experiences.length - 3})
                  </summary>
                  {profile.experiences.slice(3).map((item) => (
                    <p key={item.id} className="py-2 leading-6 text-muted-foreground">
                      {item.title} · {item.subtitle} · {item.period}
                    </p>
                  ))}
                </details>
              )}
            </section>
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Round evaluations</h3>
              {scores.length ? (
                <dl className="divide-y divide-border">
                  {scores.map((item) => (
                    <div
                      key={item.round.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <dt className="text-sm">
                        {item.round.name}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.count} saved {item.count === 1 ? "evaluation" : "evaluations"}
                        </span>
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums">
                        {item.score?.toFixed(1)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">/ 10</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No round evaluations recorded.</p>
              )}
              <p className="text-xs leading-6 text-muted-foreground">
                Average of saved evaluations within each round.
              </p>
            </section>
          </div>
          {app.evaluations.some((item) => item.notes) && (
            <details className="text-sm">
              <summary className="w-fit cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">
                Review evaluation notes
              </summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {app.evaluations
                  .filter((item) => item.notes)
                  .map((item) => (
                    <div key={item.id} className="border-l-2 border-border pl-4">
                      <p className="text-xs font-medium">
                        {item.round} · {item.score} / 10
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                        {item.notes}
                      </p>
                    </div>
                  ))}
              </div>
            </details>
          )}
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
              Presentation only. The club president records final decisions.
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
