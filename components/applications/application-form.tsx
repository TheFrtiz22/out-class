"use client"
import { useAutosave } from "@/hooks/use-autosave"
import { AutosaveStatus } from "@/components/ui/autosave-status"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { applicationAnswersKey } from "@/lib/student-applications"
import { QuestionField } from "@/components/applications/question-field"
import { applicationAvailability } from "@/lib/club-settings"
import { testRequirementLabels } from "@/lib/test-scores"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Check, FileText } from "lucide-react"
import {
  saveApplicationDraft,
  submitApplication,
  type getStudentApplications,
} from "@/lib/workspace-api"
import { uploadProfileFile } from "@/lib/workspace-api"
import { answerErrors, wordCount, applicationResponseProgress } from "@/lib/student-applications"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export type StudentApplication = Awaited<ReturnType<typeof getStudentApplications>>[number]
export function ApplicationForm({
  application,
  onSaved,
  onDirty,
  onBusy,
  onProfile,
}: {
  application: StudentApplication
  onSaved: (submitted: boolean, answers: StudentApplication["answers"]) => void
  onBusy: (busy: boolean) => void
  onDirty: (dirty: boolean) => void
  onProfile: () => void
}) {
  const closed = !applicationAvailability(application.club)
  const questions = application.club.questions
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(application.answers.map((answer) => [answer.questionId, answer.response])),
  )
  const { user } = useAuth()
  const demo = useDemoMode()
  const expected = useRef(applicationAnswersKey(application.answers))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const answers = questions.map((question) => ({
    questionId: question.id,
    response: responses[question.id] || "",
  }))
  const autosave = useAutosave({
    identity: `${demo.isDemoEnabled ? "demo:" : ""}${user?.id}:application:${application.id}`,
    value: responses, restore: setResponses,
    save: async snapshot => {
      const savedAnswers = questions.map(q => ({ questionId: q.id, response: snapshot[q.id] || "" }))
      await saveApplicationDraft({ clubId: application.clubId, answers: savedAnswers, expectedAnswers: expected.current })
      expected.current = applicationAnswersKey(savedAnswers)
      onSaved(false, savedAnswers)
    },
  })
  const dirty = autosave.dirty
  const required = questions.filter((question) => question.required)
  const progress = applicationResponseProgress(questions, answers)
  const completed = progress.completed
  useEffect(() => {
    onDirty(dirty)
    onBusy(busy)
  }, [dirty, busy, onDirty, onBusy])
  function change(id: string, value: string) {
    setResponses((current) => ({ ...current, [id]: value }))
    setMessage("")
    setError("")
    setErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }
  async function persist(final: boolean) {
    if (busy) return
    const validation = answerErrors(questions, answers, final)
    setErrors(validation)
    if (Object.keys(validation).length) {
      setConfirm(false)
      setError("Check the highlighted responses before continuing.")
      document.getElementById(`answer-${Object.keys(validation)[0]}`)?.focus()
      return
    }
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await autosave.flush()
      await (final ? submitApplication : saveApplicationDraft)({
        clubId: application.clubId,
        answers,
        expectedAnswers: expected.current,
      })
      await autosave.reset()
      setConfirm(false)
      setMessage(final ? "Application submitted." : "Draft saved to your account.")
      onSaved(final, answers)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      setError(
        /already|profile|pipeline|questions|words|response|URL|closed|option/.test(message)
          ? message
          : "We couldn’t save your application. Your responses are still here. Please try again.",
      )
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }
  async function upload(id: string, file?: File) {
    if (!file) return
    if (!["application/pdf", "application/octet-stream", ""].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        [id]: "Choose a PDF up to 10 MB, or add a document link.",
      }))
      return
    }
    setBusy(true)
    setError("")
    try {
      const input = new FormData()
      input.set("kind", "resume")
      input.set("file", file)
      const upload = await uploadProfileFile(input)
      change(id, upload.reference)
      setMessage("Document uploaded. Your attachment will save automatically.")
    } catch {
      setError("The document upload failed. Your previous response has not changed.")
    } finally {
      setBusy(false)
    }
  }
  function review(event: FormEvent) {
    event.preventDefault()
    const validation = answerErrors(questions, answers, true)
    setErrors(validation)
    setError("")
    if (Object.keys(validation).length) {
      setError("A few responses need your attention. Your draft can still be saved.")
      document.getElementById(`answer-${Object.keys(validation)[0]}`)?.focus()
    } else setConfirm(true)
  }
  return (
    <div data-autosave-editor="true" data-application-form data-unsaved={dirty} data-saving={busy || autosave.saving} onBlur={autosave.onBlur} className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
        <p>
          {required.length
            ? `${completed} of ${required.length} required responses ready`
            : "No required questions"}
        </p>
        <AutosaveStatus save={autosave} />
      </div>
      <div className="oc-draft-progress-summary"><Progress value={progress.percent} aria-label="Required application responses ready" />{progress.nextQuestionId && <Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => { const field = document.getElementById(`answer-${progress.nextQuestionId}`); field?.scrollIntoView({ block: "center", behavior: "instant" }); field?.focus({ preventScroll: true }) }}>Continue to next response</Button>}</div>
      <div className="flex items-start gap-3 text-sm leading-relaxed">
        <FileText className="mt-1 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p>Your shared profile gives the club your academic and experience details.</p>
          <p>{testRequirementLabels[(application.club.testRequirement || "OPTIONAL") as keyof typeof testRequirementLabels]}. Scores are taken from your profile; SAT and ACT are never converted.</p>
          <Button variant="link" className="h-auto px-0 py-1" disabled={busy} onClick={onProfile}>
            Review your profile
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <form onSubmit={review} noValidate className="space-y-8">
        {closed && <p role="status" className="text-sm text-muted-foreground">Applications are closed. You can still save your draft.</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-9">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                Question {index + 1}
                <span aria-hidden="true"> · </span>
                {question.required ? "Required" : "Optional"}
              </div>
              <Label
                htmlFor={`answer-${question.id}`}
                className="block whitespace-pre-wrap text-base font-medium leading-7"
              >
                {question.prompt}
              </Label>
              <QuestionField question={question} value={responses[question.id] || ""} onChange={value => change(question.id, value)} invalid={!!errors[question.id]} />
              {question.type === "FILE_UPLOAD" && (
                <div className="space-y-2">
                  <Label htmlFor={`upload-${question.id}`} className="text-xs">
                    Or upload a PDF (up to 10 MB)
                  </Label>
                  <Input
                    id={`upload-${question.id}`}
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => {
                      void upload(question.id, event.target.files?.[0])
                      event.target.value = ""
                    }}
                  />
                </div>
              )}
              <div
                id={`help-${question.id}`}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {question.type === "ESSAY"
                  ? `${wordCount(responses[question.id] || "")} words${question.wordLimit != null ? ` · ${question.wordLimit} maximum` : " · No word limit specified"}`
                  : question.type === "FILE_UPLOAD"
                    ? "Use a document link the club can access. Attachments save automatically; uploading never submits your application."
                    : "Enter your selection from the choices in the prompt. If no choices are listed, ask the club for clarification."}
                {errors[question.id] && (
                  <p className="mt-2 text-destructive" role="alert">
                    {errors[question.id]}
                  </p>
                )}
              </div>
            </div>
          ))}
          {!questions.length && (
            <p className="py-5 text-sm text-muted-foreground">
              This club has not added application questions. Your submission will use your shared
              profile.
            </p>
          )}
        </fieldset>
        <div className="oc-application-actions flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background py-5">
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Your draft saves automatically. Nothing is submitted until you confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || closed}>
              Review & submit
            </Button>
          </div>
        </div>
      </form>
      <Dialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value)
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Ready to send your application?</DialogTitle>
            <DialogDescription>
              You’re applying to {application.club.name}. Your answers cannot be edited after
              submission.
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-center gap-2 text-sm">
            <Check className="size-4" />
            {completed} of {required.length} required responses added
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
              Keep editing
            </Button>
            <Button disabled={busy} onClick={() => void persist(true)}>
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
