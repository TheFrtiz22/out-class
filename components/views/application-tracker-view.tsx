"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Compass, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { trackedApplications } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import type { ViewId } from "@/lib/views"

const CHAR_LIMIT = 1000

type DraftTab = {
  id: string
  clubId: string
  clubName: string
  deadline: string
  question: string
  fileLabel: string
}

const draftTabs: DraftTab[] = trackedApplications
  .filter((app) => app.status !== "Decision Pending")
  .map((app) => ({
    id: app.id,
    clubId: app.clubId,
    clubName: app.clubName,
    deadline: "Sept 20 at 11:59 PM",
    question: `Why do you want to join ${app.clubName}?`,
    fileLabel: "Upload your stock pitch deck.",
  }))

export function ApplicationTrackerView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { focusApplicationClubId, clearApplicationFocus } = useApplicationState()
  const [openTabs, setOpenTabs] = useState<DraftTab[]>(draftTabs)
  const [activeId, setActiveId] = useState<string | null>(draftTabs[0]?.id ?? null)

  // When the Dashboard's "Continue"/"View Application" buttons hand off a
  // specific club, open that club's canvas instead of whatever was active.
  useEffect(() => {
    if (!focusApplicationClubId) return
    const matchingTab = openTabs.find((tab) => tab.clubId === focusApplicationClubId)
    if (matchingTab) {
      setActiveId(matchingTab.id)
    }
    clearApplicationFocus()
  }, [focusApplicationClubId, openTabs, clearApplicationFocus])
  const [answer, setAnswer] = useState(
    "I want the discipline of managing real capital alongside people who argue about theses in good faith. ".slice(
      0,
      450,
    ),
  )
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const activeTab = useMemo(() => openTabs.find((tab) => tab.id === activeId) ?? null, [openTabs, activeId])

  // Mocked real-time validation: the progress bar fills as the essay grows toward the character limit.
  const completionPercent = Math.min(100, Math.round((answer.length / CHAR_LIMIT) * 100))

  function handleSubmit(id: string) {
    setSubmittedIds((prev) => new Set(prev).add(id))
  }

  function closeTab(id: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
  }

  if (openTabs.length === 0 || !activeTab) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">My Application Workspace</h1>
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-white text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-slate-100">
            <Compass className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">You have no active applications.</p>
            <p className="text-sm text-muted-foreground">Find a club worth applying to and start a draft.</p>
          </div>
          <Button onClick={() => onNavigate?.("discover")}>Discover Clubs</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">My Application Workspace</h1>

      {/* Google Docs-style tab bar */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-border">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`group relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-primary bg-white text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:bg-slate-100 hover:text-foreground"
              }`}
            >
              <span className="max-w-40 truncate">{tab.clubName}</span>
              {!isActive && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Withdraw draft for ${tab.clubName}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }
                  }}
                  className="rounded-full p-0.5 text-muted-foreground/70 opacity-0 transition-opacity hover:bg-slate-200 hover:text-foreground group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active application canvas */}
      <div className="rounded-b-xl rounded-tr-xl border border-gray-200 bg-white">
        {submittedIds.has(activeTab.id) ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="size-9 text-success" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Application Submitted to {activeTab.clubName}!</h2>
              <p className="text-sm text-gray-500">
                We&apos;ve notified the club&apos;s leadership. You&apos;ll be updated here as your status changes.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-primary text-white hover:bg-primary/90"
              onClick={() => onNavigate?.("student-dashboard")}
            >
              Return to Dashboard to Track Status
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 p-6 pb-28 sm:p-8 sm:pb-28">
              {/* Top info bar */}
              <div className="space-y-3 border-b border-gray-200 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-red-600">Deadline: {activeTab.deadline}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <CheckCircle2 className="size-3.5 text-success" />
                    Auto-Saved at 3:42 PM
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Progress value={completionPercent} className="h-2" />
                  <p className="text-xs text-gray-500">{completionPercent}% Complete</p>
                </div>
              </div>

              {/* Base profile banner */}
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <p className="text-sm leading-relaxed text-success">
                  Your OutClass Base Profile (Resume, GPA, Major) is automatically attached to this submission.
                </p>
              </div>

              {/* Question 1 — essay with character counter */}
              <div className="space-y-2">
                <label htmlFor="essay-answer" className="text-sm font-medium text-foreground">
                  {activeTab.question}
                </label>
                <Textarea
                  id="essay-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.slice(0, CHAR_LIMIT))}
                  placeholder="Start writing your response…"
                  className="min-h-40 resize-none text-sm"
                  maxLength={CHAR_LIMIT}
                />
                <p className="text-right text-xs text-gray-500">
                  {answer.length} / {CHAR_LIMIT} characters
                </p>
              </div>

              {/* Question 2 — file dropzone */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{activeTab.fileLabel}</p>
                <label
                  htmlFor="pitch-deck-upload"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-white px-6 py-10 text-center transition-colors hover:border-border hover:bg-orange-50/40"
                >
                  <UploadCloud className="size-6 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-muted-foreground">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PDF, PPTX up to 25MB</p>
                  <input id="pitch-deck-upload" type="file" className="sr-only" />
                </label>
              </div>
            </div>

            {/* Sticky action footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
              <Button variant="ghost" className="text-gray-600 hover:bg-gray-100 hover:text-foreground">
                Save Draft
              </Button>
              <Button
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => handleSubmit(activeTab.id)}
              >
                Submit Final Application
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
