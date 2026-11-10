"use client"
import { NativeSelect } from "@/components/ui/native-select"
import { Checkbox } from "@/components/ui/checkbox"
import { isChoiceQuestion as isChoice, type QuestionDraft } from "@/lib/club-settings"

/** "Always show" by default; optionally show only for certain answers to an earlier choice question. */
export function ConditionEditor({ question, earlier, onChange }: { question: QuestionDraft; earlier: QuestionDraft[]; onChange: (showIf: QuestionDraft["showIf"]) => void }) {
  const parents = earlier.filter(q => isChoice(q) && q.options.some(option => option.trim()))
  if (!parents.length && !question.showIf) return null
  const parent = parents.find(p => p.id === question.showIf?.questionId)
  return <div className="space-y-2 text-sm">
    <label className="space-y-2">
      <span className="block">Show this question</span>
      <NativeSelect className="oc-settings-select" value={question.showIf?.questionId ?? ""}
        onChange={e => { const next = parents.find(p => p.id === e.target.value); onChange(next ? { questionId: next.id, anyOf: next.options.filter(Boolean).slice(0, 1) } : null) }}>
        <option value="">Always</option>
        {parents.map(p => <option key={p.id} value={p.id}>Only after an answer to “{(p.prompt || "Untitled question").slice(0, 60)}”</option>)}
      </NativeSelect>
    </label>
    {parent && question.showIf && <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label="Answers that show this question">
      {parent.options.filter(Boolean).map(option => <label key={option} className="inline-flex min-h-11 items-center gap-2">
        <Checkbox checked={question.showIf!.anyOf.includes(option)} onCheckedChange={checked => {
          const anyOf = parent.options.filter(item => item === option ? checked === true : question.showIf!.anyOf.includes(item))
          onChange(anyOf.length ? { questionId: parent.id, anyOf } : null)
        }} />{option}
      </label>)}
    </div>}
  </div>
}
