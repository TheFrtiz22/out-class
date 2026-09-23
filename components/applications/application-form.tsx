"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, FileText } from "lucide-react"
import {
  saveApplicationDraft,
  submitApplication,
  type getStudentApplications,
} from "@/lib/workspace-api"
import { getSignedUploadUrl } from "@/lib/workspace-api"
import { answerErrors, wordCount } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  const questions = application.club.questions
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(application.answers.map((answer) => [answer.questionId, answer.response])),
  )
  const [baseline, setBaseline] = useState(JSON.stringify(responses))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const dirty = JSON.stringify(responses) !== baseline
  const answers = questions.map((question) => ({
    questionId: question.id,
    response: responses[question.id] || "",
  }))
  const required = questions.filter((question) => question.required)
  const completed = required.filter((question) => responses[question.id]?.trim()).length
  useEffect(() => {
    onDirty(dirty)
    onBusy(busy)
  }, [dirty, busy, onDirty, onBusy])
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    // The shell uses buttons rather than URL navigation. Guard leaving an unsaved form there too.
    const navigate = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (
        !target.closest("[data-application-form]") &&
        target.closest("nav button, nav a, [data-shell-navigation]")
      ) {
        if (busy || !window.confirm("Leave this application? Your unsaved changes will be lost.")) {
          event.preventDefault()
          event.stopPropagation()
        }
      }
    }
    document.addEventListener("click", navigate, true)
    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", navigate, true)
    }
  }, [dirty, busy])
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
      await (final ? submitApplication : saveApplicationDraft)({
        clubId: application.clubId,
        answers,
      })
      setBaseline(JSON.stringify(responses))
      setConfirm(false)
      setMessage(final ? "Application submitted." : "Draft saved to your account.")
      onSaved(final, answers)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      setError(
        /already|profile|pipeline|questions|words|response|URL/.test(message)
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
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        [id]: "Choose a PDF up to 10 MB, or add a document link.",
      }))
      return
    }
    setBusy(true)
    setError("")
    try {
      const upload = await getSignedUploadUrl({ fileName: file.name, bucket: "resumes" })
      const response = await fetch(upload.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      })
      if (!response.ok) throw new Error()
      change(id, upload.publicUrl)
      setMessage("Document uploaded. Save your draft to keep the attachment.")
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
    <div data-application-form data-unsaved={dirty} data-saving={busy} className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
        <p>
          {required.length
            ? `${completed} of ${required.length} required responses added`
            : "No required questions"}
        </p>
        <span role="status" className="text-xs text-muted-foreground">
          {busy ? "Working…" : dirty ? "Unsaved changes" : message || "Saved responses loaded"}
        </span>
      </div>
      <div className="flex items-start gap-3 text-sm leading-relaxed">
        <FileText className="mt-1 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p>Your shared profile gives the club your academic and experience details.</p>
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
              {question.type === "ESSAY" ? (
                <Textarea
                  id={`answer-${question.id}`}
                  rows={7}
                  className="min-h-44 text-base leading-7"
                  value={responses[question.id] || ""}
                  onChange={(event) => change(question.id, event.target.value)}
                  aria-required={question.required}
                  aria-invalid={!!errors[question.id]}
                  aria-describedby={`help-${question.id}`}
                  placeholder="Take your time. Write in your own voice."
                />
              ) : (
                <Input
                  id={`answer-${question.id}`}
                  type={question.type === "FILE_UPLOAD" ? "url" : "text"}
                  value={responses[question.id] || ""}
                  onChange={(event) => change(question.id, event.target.value)}
                  aria-required={question.required}
                  aria-invalid={!!errors[question.id]}
                  aria-describedby={`help-${question.id}`}
                  placeholder={question.type === "FILE_UPLOAD" ? "https://…" : "Your response"}
                />
              )}
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
                    ? "Use a document link the club can access. Uploading does not save or submit your application."
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
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background py-5">
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Save and come back whenever you need. Nothing is submitted until you confirm.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void persist(false)}
            >
              Save draft
            </Button>
            <Button type="submit" disabled={busy}>
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
