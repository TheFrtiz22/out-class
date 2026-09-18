"use client"

import { Users } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import type { WorkspaceQuestion } from "@/lib/data"

export function WorkspaceQuestionCard({
  question,
  index,
  scale,
  score,
  note,
  onScoreChange,
  onNoteChange,
}: {
  question: WorkspaceQuestion
  index: number
  scale: 5 | 10
  score: number
  note: string
  onScoreChange: (value: number) => void
  onNoteChange: (value: string) => void
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="gap-1">
        <p className="text-xs font-medium text-muted-foreground">Question {index + 1}</p>
        <p className="text-sm font-semibold leading-snug text-foreground">{question.prompt}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Score</span>
            <span className="text-sm font-bold text-muted-foreground">
              {score || 0} <span className="text-xs font-normal text-muted-foreground">/ {scale}</span>
            </span>
          </div>
          <Slider
            value={[score]}
            min={0}
            max={scale}
            step={1}
            onValueChange={([value]) => onScoreChange(value)}
            aria-label={`Score for question ${index + 1}`}
            className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-foreground"
          />
        </div>

        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Type your live notes here..."
          className="min-h-24 resize-none"
          aria-label={`Notes for question ${index + 1}`}
        />

        {question.collaboratorComments.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              Collaborator Comments
            </p>
            <div className="space-y-2">
              {question.collaboratorComments.map((comment) => (
                <div
                  key={comment.interviewer}
                  className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-slate-100 p-2.5"
                >
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className="bg-slate-300 text-[10px] font-medium text-slate-700">
                      {comment.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-slate-700">
                      {comment.interviewer}: <span className="font-semibold">{comment.score}/{scale}</span>
                    </p>
                    <p className="text-slate-500">{comment.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
