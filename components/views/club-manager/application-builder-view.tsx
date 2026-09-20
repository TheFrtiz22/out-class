"use client"

import { useState } from "react"
import {
  Lock,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  User,
  GraduationCap,
  FileText,
  Award,
  FileType2,
  ListChecks,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initialBuilderQuestions, type BuilderQuestion, type BuilderQuestionType } from "@/lib/data"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const FILE_TYPE_OPTIONS = ["Video Files (.mp4, .mov)", "PDF Documents (.pdf)", "Audio Files (.mp3, .wav)"]

const TYPE_META: Record<BuilderQuestionType, { label: string; icon: typeof FileType2 }> = {
  essay: { label: "Essay Question", icon: FileText },
  "file-upload": { label: "Video / Portfolio File Upload", icon: FileType2 },
  "multiple-choice": { label: "Multiple Choice / Checkbox Grid", icon: ListChecks },
}

function newQuestion(type: BuilderQuestionType): BuilderQuestion {
  const id = `bq-${Date.now()}`
  if (type === "essay") {
    return { id, type, prompt: "", required: true, enforceWordCount: false, minWords: 100, maxWords: 300 }
  }
  if (type === "file-upload") {
    return { id, type, prompt: "", required: true, allowedFileTypes: FILE_TYPE_OPTIONS[0], maxFileSizeMb: 500 }
  }
  return { id, type, prompt: "", required: false, options: ["Option 1", "Option 2"] }
}

export function ApplicationBuilderView() {
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialBuilderQuestions)

  function updateQuestion(id: string, patch: Partial<BuilderQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  function addQuestion(type: BuilderQuestionType) {
    setQuestions((prev) => [...prev, newQuestion(type)])
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id)
      const target = index + dir
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateOption(qid: string, optIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid && q.options
          ? { ...q, options: q.options.map((o, i) => (i === optIndex ? value : o)) }
          : q,
      ),
    )
  }

  function addOption(qid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid && q.options ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] } : q,
      ),
    )
  }

  function removeOption(qid: string, optIndex: number) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid && q.options ? { ...q, options: q.options.filter((_, i) => i !== optIndex) } : q)),
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-sans tracking-tight font-semibold">Application Question Customizer — Fall 2026 Cycle</CardTitle>
          <CardDescription>Build the custom questions applicants answer beyond their base OutClass profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-dashed bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-3.5 text-muted-foreground" />
              Standard Base OutClass Profile (Auto-Attached)
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every applicant automatically includes these fields — they cannot be removed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <User className="size-3.5" /> Name
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5" /> Major & Year
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="size-3.5" /> Resume PDF
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <Award className="size-3.5" /> SAT / GPA
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionBlockCard
                key={q.id}
                index={i}
                question={q}
                isFirst={i === 0}
                isLast={i === questions.length - 1}
                onMove={(dir) => moveQuestion(q.id, dir)}
                onUpdate={(patch) => updateQuestion(q.id, patch)}
                onRemove={() => removeQuestion(q.id)}
                onUpdateOption={(idx, val) => updateOption(q.id, idx, val)}
                onAddOption={() => addOption(q.id)}
                onRemoveOption={(idx) => removeOption(q.id, idx)}
              />
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <Plus className="size-4" /> Add New Question
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-64">
                {(Object.keys(TYPE_META) as BuilderQuestionType[]).map((type) => {
                  const Icon = TYPE_META[type].icon
                  return (
                    <DropdownMenuItem key={type} onClick={() => addQuestion(type)} className="gap-2">
                      <Icon className="size-4" /> {TYPE_META[type].label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Button
          size="lg"
          onClick={() => toast.success("Application published", { description: "Live for Fall 2026 Recruitment." })}
        >
          Publish Application for Fall Recruitment
        </Button>
      </div>
    </div>
  )
}

function QuestionBlockCard({
  index,
  question: q,
  isFirst,
  isLast,
  onMove,
  onUpdate,
  onRemove,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}: {
  index: number
  question: BuilderQuestion
  isFirst: boolean
  isLast: boolean
  onMove: (dir: -1 | 1) => void
  onUpdate: (patch: Partial<BuilderQuestion>) => void
  onRemove: () => void
  onUpdateOption: (index: number, value: string) => void
  onAddOption: () => void
  onRemoveOption: (index: number) => void
}) {
  const Icon = TYPE_META[q.type].icon
  const wordCountPreview =
    q.enforceWordCount && q.minWords != null && q.maxWords != null
      ? `0 / ${q.maxWords} words (min ${q.minWords})`
      : null

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <div className="mt-1.5 flex flex-col items-center gap-1 text-muted-foreground">
          <GripVertical className="size-4" />
          <button
            type="button"
            aria-label="Move question up"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className={cn("rounded hover:text-foreground", isFirst && "opacity-30")}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move question down"
            disabled={isLast}
            onClick={() => onMove(1)}
            className={cn("rounded hover:text-foreground", isLast && "opacity-30")}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <Icon className="size-3.5" />
              {index + 1}. {TYPE_META[q.type].label}
            </Badge>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch
                  id={`required-${q.id}`}
                  checked={q.required}
                  onCheckedChange={(v) => onUpdate({ required: v })}
                />
                <Label htmlFor={`required-${q.id}`} className="text-xs font-normal text-muted-foreground">
                  Required Field
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                aria-label="Delete question"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <Input
            value={q.prompt}
            placeholder="Type the question prompt…"
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            className="bg-background"
          />

          {q.type === "essay" && (
            <div className="space-y-3 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`wc-${q.id}`} className="text-sm font-medium">
                  Enforce Word Count
                </Label>
                <Switch
                  id={`wc-${q.id}`}
                  checked={q.enforceWordCount}
                  onCheckedChange={(v) => onUpdate({ enforceWordCount: v })}
                />
              </div>
              {q.enforceWordCount && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Min Words</Label>
                      <Input
                        type="number"
                        value={q.minWords ?? 0}
                        onChange={(e) => onUpdate({ minWords: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Max Words</Label>
                      <Input
                        type="number"
                        value={q.maxWords ?? 0}
                        onChange={(e) => onUpdate({ maxWords: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Textarea
                      placeholder="Applicant response preview…"
                      rows={3}
                      disabled
                      className="resize-none bg-muted/40 text-muted-foreground"
                    />
                    <p className="text-right text-xs text-muted-foreground">{wordCountPreview}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {q.type === "file-upload" && (
            <div className="space-y-3 rounded-md border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Allowed file types</Label>
                  <Select
                    value={q.allowedFileTypes}
                    onValueChange={(v) => onUpdate({ allowedFileTypes: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max file size (MB)</Label>
                  <Input
                    type="number"
                    value={q.maxFileSizeMb ?? 0}
                    onChange={(e) => onUpdate({ maxFileSizeMb: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-center text-muted-foreground">
                <FileType2 className="size-6" />
                <p className="text-xs">Applicant dropzone preview — {q.allowedFileTypes}, up to {q.maxFileSizeMb} MB</p>
              </div>
            </div>
          )}

          {q.type === "multiple-choice" && (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <Label className="text-xs text-muted-foreground">Answer options</Label>
              {q.options?.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="size-3.5 shrink-0 rounded-sm border border-muted-foreground/40" />
                  <Input value={opt} onChange={(e) => onUpdateOption(i, e.target.value)} className="h-8 text-sm" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveOption(i)}
                    aria-label="Remove option"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onAddOption}>
                <Plus className="size-3.5" /> Add option
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
