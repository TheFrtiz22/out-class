"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, FileText, LinkIcon, PartyPopper } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Applicant } from "@/lib/data"

type Decision = "advance" | "waitlist" | "reject"

type SpeedReviewModeProps = {
  candidates: Applicant[]
  onClose: () => void
  onDecide: (id: string, decision: Decision) => void
}

const SHORTCUTS = [
  { key: "←", label: "Previous" },
  { key: "R", label: "Reject" },
  { key: "A", label: "Advance" },
  { key: "→", label: "Skip" },
]

export function SpeedReviewMode({ candidates, onClose, onDecide }: SpeedReviewModeProps) {
  const [index, setIndex] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [autoLoadNext, setAutoLoadNext] = useState(true)

  const total = candidates.length
  const candidate = index < total ? candidates[index] : null

  function goPrevious() {
    setIndex((i) => Math.max(0, i - 1))
  }

  function goNext() {
    setIndex((i) => Math.min(total, i + 1))
  }

  function decide(decision: Decision) {
    if (!candidate) return
    onDecide(candidate.id, decision)
    if (autoLoadNext) {
      setIndex((i) => Math.min(total, i + 1))
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrevious()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        decide("reject")
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        decide("advance")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, autoLoadNext, total])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-foreground">
      {/* Top header bar */}
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-1.5 text-sm font-medium text-foreground hover:bg-slate-100 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to CRM
        </Button>

        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-foreground">
          {total === 0
            ? "No candidates in queue"
            : `Reviewing Candidate ${Math.min(index + 1, total)} of ${total}`}
        </p>

        <div className="hidden items-center gap-3 sm:flex">
          {SHORTCUTS.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <kbd className="rounded border border-gray-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                {s.key}
              </kbd>
              {s.label}
            </span>
          ))}
        </div>
      </header>

      {/* Split-screen workspace */}
      {candidate ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — The Application (70%) */}
          <div className="w-[70%] overflow-y-auto bg-white p-6 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.04)]">
            <div className="mx-auto max-w-2xl space-y-6">
              {/* Base profile header */}
              <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-none">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-foreground/10 text-lg font-semibold text-foreground">
                    {candidate.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-foreground">{candidate.name}</h2>
                  <p className="truncate text-sm text-gray-500">
                    {candidate.year} · {candidate.major} · GPA {candidate.gpa}
                  </p>
                </div>
                <div className="shrink-0 rounded-md bg-slate-50 px-3 py-1.5 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">SAT</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{candidate.satScore}</p>
                </div>
              </div>

              {/* Essays */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Essay Responses</h3>
                {candidate.essays.map((essay, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 shadow-none">
                    <p className="text-xs font-medium text-gray-500">{essay.question}</p>
                    <p className="mt-1.5 text-pretty text-sm leading-relaxed text-foreground">{essay.answer}</p>
                  </div>
                ))}
                {candidate.essays.length === 0 && (
                  <p className="text-sm text-gray-400">No essay responses submitted.</p>
                )}
              </div>

              {candidate.links.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Links</h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.links.map((link) => (
                      <span
                        key={link.url}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1 text-xs text-gray-500"
                      >
                        <LinkIcon className="size-3" />
                        {link.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulated resume / PDF embed */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Resume</h3>
                <div className="rounded-lg border border-gray-200 bg-white shadow-none">
                  <div className="flex items-center gap-2 border-b border-gray-200 bg-slate-50 px-3 py-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{candidate.resumeFileName}</span>
                    <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                      PDF
                    </span>
                  </div>
                  <div className="space-y-2.5 p-5">
                    {[100, 92, 96, 60, 88, 84, 70, 90, 95, 55].map((width, i) => (
                      <div
                        key={i}
                        className={cn("h-2 rounded-full bg-gray-100", i === 3 || i === 9 ? "bg-gray-50" : "")}
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel — The Decision Console (30%) */}
          <div className="flex w-[30%] flex-col gap-4 overflow-y-auto bg-slate-50 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="speed-review-notes" className="text-xs font-medium text-foreground">
                Quick Notes
              </Label>
              <Textarea
                id="speed-review-notes"
                value={notes[candidate.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [candidate.id]: e.target.value }))}
                placeholder="Jot down rapid impressions…"
                className="min-h-32 border-gray-200 bg-white text-sm text-foreground placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white p-3">
              <Label htmlFor="auto-load-toggle" className="text-xs font-medium leading-snug text-foreground">
                Auto-load next candidate on decision
              </Label>
              <Switch id="auto-load-toggle" checked={autoLoadNext} onCheckedChange={setAutoLoadNext} />
            </div>

            <div className="mt-2 flex flex-col gap-3">
              <Button
                size="lg"
                onClick={() => decide("advance")}
                className="h-14 w-full justify-center text-base font-semibold bg-primary text-white hover:bg-primary/90"
              >
                Advance to Round 1
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => decide("waitlist")}
                className="h-14 w-full justify-center border-foreground text-base font-semibold text-foreground hover:bg-foreground/5"
              >
                Waitlist / Hold
              </Button>
              <Button
                size="lg"
                onClick={() => decide("reject")}
                className="h-14 w-full justify-center bg-gray-200 text-base font-semibold text-gray-700 hover:bg-gray-300"
              >
                Reject
              </Button>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={goPrevious}
                className="gap-1 text-xs text-foreground hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft className="size-3.5" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goNext}
                className="gap-1 text-xs text-foreground hover:bg-slate-100 hover:text-foreground"
              >
                Skip
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <PartyPopper className="size-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Queue complete</h2>
            <p className="max-w-sm text-sm text-gray-500">
              You&apos;ve reviewed every candidate in this Speed Review queue. Decisions have been synced to the CRM.
            </p>
            <Button onClick={onClose} className="mt-2 bg-primary text-white hover:bg-primary/90">
              Back to CRM
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
