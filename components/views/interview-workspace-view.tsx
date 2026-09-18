"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { interviewCandidate, workspaceRounds } from "@/lib/data"
import { WorkspaceQuestionCard } from "@/components/views/interview/workspace-question-card"

const DEFAULT_MINUTES = 15
const SCALE = 5 as const

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function InterviewWorkspaceView() {
  const [leftOpen, setLeftOpen] = useState(true)
  const [contextTab, setContextTab] = useState("profile")

  const [scores, setScores] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60)
  const totalSeconds = DEFAULT_MINUTES * 60

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const activeRound = useMemo(
    () => workspaceRounds.find((round) => round.id === interviewCandidate.activeRoundId) ?? workspaceRounds[0],
    [],
  )

  const scoredValues = activeRound.questions
    .map((question) => scores[question.id])
    .filter((value): value is number => typeof value === "number" && value > 0)
  const aggregate = scoredValues.length > 0 ? scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length : 0

  const timeUrgent = secondsLeft <= 60 && secondsLeft > 0
  const timeUp = secondsLeft === 0
  const progressPct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0

  function handleSubmit() {
    toast.success("Submitted & synced to CRM", {
      description: `${interviewCandidate.name}'s scores and comments were pushed to the Applicant CRM — aggregate ${aggregate.toFixed(1)}/${SCALE}.`,
    })
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900">
      {/* Global Header — read-only status */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="bg-foreground/10 text-sm font-semibold text-foreground">
              {interviewCandidate.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{interviewCandidate.name}</p>
            <p className="truncate text-xs text-slate-500">
              {interviewCandidate.year} · {interviewCandidate.major}
            </p>
          </div>
          <Badge className="ml-2 shrink-0 border-none bg-foreground font-medium text-white">
            Active: {activeRound.label.replace(": ", " ")}
          </Badge>
        </div>

        <span
          className={cn(
            "font-mono text-2xl font-bold tabular-nums tracking-tight",
            timeUp ? "text-red-600" : timeUrgent ? "text-red-600" : "text-muted-foreground",
          )}
        >
          {formatTime(secondsLeft)}
        </span>
      </div>

      {/* Timer progress rail */}
      <div className="h-0.5 w-full shrink-0 bg-slate-100">
        <div
          className={cn("h-full transition-[width] duration-1000", timeUp ? "bg-red-600" : "bg-primary")}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Split-screen body */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel — Applicant Context (minimizable) */}
        {leftOpen && (
          <div className="flex w-[34%] min-w-[280px] max-w-sm shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Applicant Context</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-slate-500 hover:text-foreground"
                onClick={() => setLeftOpen(false)}
              >
                <ChevronLeft className="size-3.5" />
                Minimize Profile
              </Button>
            </div>

            <Tabs value={contextTab} onValueChange={setContextTab} className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList className="w-full shrink-0 justify-start rounded-none border-b border-slate-200 bg-transparent p-0">
                <TabsTrigger
                  value="profile"
                  className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs text-slate-600 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Base Profile
                </TabsTrigger>
                <TabsTrigger
                  value="essays"
                  className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs text-slate-600 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Essays
                </TabsTrigger>
                <TabsTrigger
                  value="resume"
                  className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs text-slate-600 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Resume
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
                <div className="space-y-4">
                  <p className="text-slate-600">{interviewCandidate.bio}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="border-slate-300 font-normal">
                      SAT: {interviewCandidate.satScore}
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 font-normal">
                      GPA: {interviewCandidate.gpa}
                    </Badge>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-500">Previous Clubs / Internships</p>
                    <ul className="space-y-1 text-slate-700">
                      {interviewCandidate.experience.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-500">Key Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {interviewCandidate.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="bg-slate-200 font-normal text-slate-700">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {interviewCandidate.pastRoundNotes.length > 0 && (
                    <>
                      <Separator className="bg-slate-200" />
                      <div>
                        <p className="mb-2 text-xs font-medium text-slate-500">Past Round Notes</p>
                        <div className="space-y-2">
                          {interviewCandidate.pastRoundNotes.map((note) => (
                            <div key={note.round} className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="font-medium text-foreground">{note.round}</span>
                                <span className="text-xs text-slate-500">{note.interviewer}</span>
                              </div>
                              <p className="text-slate-600">{note.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="essays" className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
                <div className="space-y-4">
                  {interviewCandidate.essays.map((essay) => (
                    <div key={essay.question}>
                      <p className="mb-1 font-medium text-foreground">{essay.question}</p>
                      <p className="text-slate-600">{essay.answer}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="resume" className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="text-sm font-medium text-foreground">{interviewCandidate.name.replace(" ", "_")}_Resume.pdf</p>
                  <p className="text-xs text-slate-500">Embedded PDF viewer placeholder</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!leftOpen && (
          <button
            type="button"
            onClick={() => setLeftOpen(true)}
            className="flex w-6 shrink-0 items-center justify-center border-r border-slate-200 bg-white hover:bg-slate-100"
            aria-label="Expand applicant context panel"
          >
            <ChevronRight className="size-4 text-slate-500" />
          </button>
        )}

        {/* Right Panel — Evaluation for the active round only */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">{activeRound.label}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
            <div className="space-y-4">
              {activeRound.questions.map((question, index) => (
                <WorkspaceQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  scale={SCALE}
                  score={scores[question.id] ?? 0}
                  note={notes[question.id] ?? ""}
                  onScoreChange={(value) => setScores((prev) => ({ ...prev, [question.id]: value }))}
                  onNoteChange={(value) => setNotes((prev) => ({ ...prev, [question.id]: value }))}
                />
              ))}
            </div>
          </div>

          {/* Sticky Footer — CRM Sync */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Total Aggregate Score</p>
                <p className="text-xl font-bold text-foreground">
                  {aggregate.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ {SCALE}</span>
                </p>
              </div>
              <Button className="bg-primary text-white hover:bg-foreground" onClick={handleSubmit}>
                Submit &amp; Sync to CRM
              </Button>
            </div>
            <p className="text-right text-xs text-slate-500">
              Scores and comments will automatically populate in the Applicant CRM.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
