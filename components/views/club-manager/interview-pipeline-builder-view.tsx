"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical, ChevronRight, Clock, ListChecks } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  initialPipelineRounds,
  ROUND_DURATIONS,
  SCORING_METRICS,
  type PipelineRound,
  type ScoringMetric,
} from "@/lib/data"

function newRound(index: number): PipelineRound {
  return {
    id: `pr-${Date.now()}`,
    name: `Round ${index}: New Round`,
    duration: "20 minutes",
    scoringMetric: "1-5 Scale",
    questions: [],
  }
}

export function InterviewPipelineBuilderView() {
  const [rounds, setRounds] = useState<PipelineRound[]>(initialPipelineRounds)
  const [selectedId, setSelectedId] = useState<string>(initialPipelineRounds[0]?.id ?? "")

  const activeRound = rounds.find((r) => r.id === selectedId) ?? rounds[0]

  function updateRound(id: string, patch: Partial<PipelineRound>) {
    setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRound() {
    const round = newRound(rounds.length + 1)
    setRounds((prev) => [...prev, round])
    setSelectedId(round.id)
  }

  function removeRound(id: string) {
    setRounds((prev) => {
      const next = prev.filter((r) => r.id !== id)
      if (id === selectedId) setSelectedId(next[0]?.id ?? "")
      return next
    })
  }

  function addQuestion(roundId: string) {
    setRounds((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? { ...r, questions: [...r.questions, { id: `prq-${Date.now()}`, text: "" }] }
          : r,
      ),
    )
  }

  function updateQuestion(roundId: string, questionId: string, text: string) {
    setRounds((prev) =>
      prev.map((r) =>
        r.id === roundId
          ? { ...r, questions: r.questions.map((q) => (q.id === questionId ? { ...q, text } : q)) }
          : r,
      ),
    )
  }

  function removeQuestion(roundId: string, questionId: string) {
    setRounds((prev) =>
      prev.map((r) =>
        r.id === roundId ? { ...r, questions: r.questions.filter((q) => q.id !== questionId) } : r,
      ),
    )
  }

  return (
    <div className="bg-white">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-foreground font-sans tracking-tight">Interview Pipeline Configuration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Define the rounds, questions, and timing your applicants move through.
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Round Manager */}
        <div className="w-full shrink-0 lg:w-64">
          <div className="rounded-md border border-gray-200 bg-white p-2">
            <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Rounds
            </p>
            <div className="flex flex-col gap-1">
              {rounds.map((round, i) => (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedId(round.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-sm transition-colors",
                    round.id === activeRound?.id
                      ? "bg-foreground text-white"
                      : "text-foreground hover:bg-slate-100",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      round.id === activeRound?.id
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{round.name}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        round.id === activeRound?.id ? "text-white/70" : "text-slate-400",
                      )}
                    >
                      {round.duration} · {round.questions.length} question
                      {round.questions.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0",
                      round.id === activeRound?.id ? "text-white/70" : "text-slate-300",
                    )}
                  />
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={addRound}
              className="mt-2 w-full justify-center gap-1.5 border border-dashed border-gray-300 text-sm font-medium text-foreground hover:bg-slate-50 hover:text-foreground"
            >
              <Plus className="size-4" /> Add New Round
            </Button>
          </div>
        </div>

        {/* Active Round Editor */}
        <div className="min-w-0 flex-1">
          {activeRound ? (
            <div className="rounded-md border border-gray-200 bg-white p-5">
              <div className="space-y-6">
                {/* Round Settings */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground font-sans tracking-tight">Round Settings</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="round-name" className="text-xs text-slate-500">
                        Round Name
                      </Label>
                      <Input
                        id="round-name"
                        value={activeRound.name}
                        onChange={(e) => updateRound(activeRound.id, { name: e.target.value })}
                        className="border-gray-200 bg-white text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="round-duration" className="text-xs text-slate-500">
                        Default Duration
                      </Label>
                      <Select
                        value={activeRound.duration}
                        onValueChange={(v) => updateRound(activeRound.id, { duration: v })}
                      >
                        <SelectTrigger id="round-duration" className="border-gray-200 bg-white text-foreground">
                          <Clock className="size-3.5 text-slate-400" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUND_DURATIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-200" />

                {/* Question Builder */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground font-sans tracking-tight">
                      <ListChecks className="size-4" /> Question Builder
                    </h3>
                    <span className="text-xs text-slate-400">
                      {activeRound.questions.length} question{activeRound.questions.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeRound.questions.length === 0 && (
                      <p className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-sm text-slate-400">
                        No questions yet. Add the first one below.
                      </p>
                    )}
                    {activeRound.questions.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2"
                      >
                        <GripVertical className="size-4 shrink-0 text-slate-300" />
                        <span className="w-5 shrink-0 text-xs font-medium text-slate-400">{i + 1}.</span>
                        <Input
                          value={q.text}
                          placeholder="Type the interview question…"
                          onChange={(e) => updateQuestion(activeRound.id, q.id, e.target.value)}
                          className="h-9 border-gray-200 bg-white text-sm text-foreground"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-slate-400 hover:text-muted-foreground"
                          onClick={() => removeQuestion(activeRound.id, q.id)}
                          aria-label="Delete question"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addQuestion(activeRound.id)}
                      className="w-full justify-center gap-1.5 border border-dashed border-gray-300 text-sm font-medium text-foreground hover:bg-slate-50 hover:text-foreground"
                    >
                      <Plus className="size-4" /> Add Question
                    </Button>
                  </div>
                </section>

                <div className="h-px bg-gray-200" />

                {/* Scoring Configuration */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground font-sans tracking-tight">Scoring Configuration</h3>
                  <div className="max-w-xs space-y-1.5">
                    <Label htmlFor="scoring-metric" className="text-xs text-slate-500">
                      Scoring Metric for This Round
                    </Label>
                    <Select
                      value={activeRound.scoringMetric}
                      onValueChange={(v) => updateRound(activeRound.id, { scoringMetric: v as ScoringMetric })}
                    >
                      <SelectTrigger id="scoring-metric" className="border-gray-200 bg-white text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCORING_METRICS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                <div className="h-px bg-gray-200" />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-sm font-medium text-muted-foreground hover:bg-orange-50 hover:text-muted-foreground"
                    onClick={() => removeRound(activeRound.id)}
                    disabled={rounds.length <= 1}
                  >
                    <Trash2 className="size-4" /> Delete This Round
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-gray-200 bg-white text-sm text-slate-400">
              No rounds yet. Add a round to get started.
            </div>
          )}
        </div>
      </div>

      {/* Save Action */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex justify-end border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Button
          type="button"
          size="lg"
          className="bg-primary text-white hover:bg-primary/90"
          onClick={() =>
            toast.success("Interview pipeline saved", {
              description: `${rounds.length} round${rounds.length === 1 ? "" : "s"} updated across the recruitment cycle.`,
            })
          }
        >
          Save Pipeline
        </Button>
      </div>
    </div>
  )
}
