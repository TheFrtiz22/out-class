"use client"
import { useState, type ReactNode } from "react"
import { FilterChips } from "@/components/ui/filter-chips"
import { Button } from "@/components/ui/button"
import { saveMyInterestSurvey } from "@/lib/workspace-api"
import { userMessage } from "@/lib/user-message"
import {
  CLUB_GOALS, INTEREST_CHIPS, MAX_INTERESTS, SELECTIVITY, WEEKLY_HOURS, emptyInterestAnswers,
  type GoalId, type InterestAnswers, type InterestId, type InterestSurveyDocument, type Selectivity, type WeeklyHours,
} from "@/lib/interest-survey"

/**
 * The four survey questions, shared by onboarding's last step, the Home prompt and Settings → Interests.
 * Saves only the signed-in student's own answers (actions/interest-survey.ts) with the revision it loaded.
 */
export function InterestSurveyForm({ initial, onSaved, secondary, submitLabel = "Save", idPrefix = "interests" }: {
  initial: InterestSurveyDocument | null
  onSaved: (survey: InterestSurveyDocument) => void
  /** A Skip or Cancel button, placed beside Save. */
  secondary?: (busy: boolean) => ReactNode
  submitLabel?: string
  idPrefix?: string
}) {
  const [answers, setAnswers] = useState<InterestAnswers>(() => initial ? { interests: initial.interests, goals: initial.goals, weeklyHours: initial.weeklyHours, selectivity: initial.selectivity } : { ...emptyInterestAnswers })
  const [revision, setRevision] = useState(initial?.revision ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<InterestAnswers>) => { setAnswers(value => ({ ...value, ...patch })); setSaved(false) }
  const full = answers.interests.length >= MAX_INTERESTS

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError("")
    try {
      const survey = await saveMyInterestSurvey({ ...answers, revision })
      setRevision(survey.revision); setSaved(true)
      onSaved(survey)
    } catch (err) {
      setError(userMessage(err, "Couldn’t save your interests. Try again."))
    } finally { setBusy(false) }
  }

  const question = (id: string, title: string, note: ReactNode, control: ReactNode) => <section aria-labelledby={`${idPrefix}-${id}`} className="space-y-2.5">
    <div className="flex items-baseline justify-between gap-3">
      <h3 id={`${idPrefix}-${id}`} className="text-sm font-semibold text-foreground">{title}</h3>
      {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
    </div>
    {control}
  </section>

  return <form onSubmit={submit} className="space-y-6" aria-busy={busy || undefined}>
    {question("into", "What are you into?", `${answers.interests.length} of ${MAX_INTERESTS}`,
      <FilterChips<InterestId> multiple label="What are you into?" value={answers.interests}
        onChange={value => set({ interests: value.slice(0, MAX_INTERESTS) })}
        options={INTEREST_CHIPS.map(chip => ({ value: chip.id, label: chip.label, disabled: full && !answers.interests.includes(chip.id) }))} />)}
    {question("goals", "What do you want from a club?", null,
      <FilterChips<GoalId> multiple label="What do you want from a club?" value={answers.goals} onChange={value => set({ goals: value })}
        options={CLUB_GOALS.map(goal => ({ value: goal.id, label: goal.label }))} />)}
    {question("hours", "How much time?", "per week",
      <FilterChips<WeeklyHours | ""> label="How much time per week?" value={answers.weeklyHours ?? ""} onChange={value => set({ weeklyHours: value || null })}
        options={WEEKLY_HOURS.map(option => ({ value: option.id, label: option.label }))} />)}
    {question("selective", "Open to applying to selective clubs?", null,
      <FilterChips<Selectivity | ""> label="Open to applying to selective clubs?" value={answers.selectivity ?? ""} onChange={value => set({ selectivity: value || null })}
        options={SELECTIVITY.map(option => ({ value: option.id, label: option.label }))} />)}
    <p className="text-xs text-muted-foreground">Only you see these. Clubs never do.</p>
    {error && <p role="alert" className="oc-feedback">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {secondary?.(busy)}
      <Button type="submit" loading={busy} disabled={busy}>{submitLabel}</Button>
      <span role="status" className="text-sm text-muted-foreground">{saved && !busy ? "Saved" : ""}</span>
    </div>
  </form>
}
