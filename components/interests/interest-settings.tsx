"use client"
import { Panel } from "@/components/ui/panel"
import { InterestSurveyForm } from "@/components/interests/interest-survey-form"
import { useInterestSurvey } from "@/hooks/use-interest-survey"
import type { InterestSurveyDocument } from "@/lib/interest-survey"

/** Settings → Interests: edit the survey any time; saving refreshes suggestions on Home and Explore. */
export function InterestSettings({ initial }: { initial: InterestSurveyDocument | null }) {
  const { update } = useInterestSurvey()
  return <Panel><InterestSurveyForm initial={initial} onSaved={update} idPrefix="settings-interests" /></Panel>
}
