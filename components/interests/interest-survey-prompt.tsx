"use client"
import dynamic from "next/dynamic"
import { useState } from "react"
import { X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { DashboardCard, DashboardQuiet } from "@/components/product/dashboard/dashboard"
import { dismissInterestSurveyPrompt } from "@/actions/interest-survey"
import { unwrapAction } from "@/lib/action-result"
import { useInterestSurvey } from "@/hooks/use-interest-survey"

// The form loads only when the student opens it.
const InterestSurveyForm = dynamic(() => import("@/components/interests/interest-survey-form").then(module => module.InterestSurveyForm), { loading: () => <div aria-hidden="true" className="h-72" /> })

/**
 * Home: a one-time, dismissible prompt for students who have not answered the interest survey.
 * Hidden once answered or dismissed (stored on the student's own row, so it stays hidden on every
 * device), in Demo Mode and in support sessions.
 */
export function InterestSurveyPrompt() {
  const { enabled, loaded, survey, update } = useInterestSurvey()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (!enabled || !loaded || !survey || survey.completed || survey.dismissed || hidden) return null

  async function dismiss() {
    setBusy(true)
    setHidden(true)
    try { update(unwrapAction(await dismissInterestSurveyPrompt())) } catch { /* hidden for this visit; it may show once more */ }
    finally { setBusy(false) }
  }

  return <DashboardCard id="home-interests-title" title="Help us suggest clubs" className="oc-home-interests" headingTabIndex={-1}
    aside={<IconButton aria-label="Dismiss" disabled={busy} onClick={() => void dismiss()}><X className="size-4" aria-hidden="true" /></IconButton>}>
    {open
      ? <InterestSurveyForm initial={survey} idPrefix="home-interests" onSaved={update}
        secondary={working => <Button type="button" variant="ghost" disabled={working} onClick={() => { setOpen(false); document.getElementById("home-interests-title")?.focus() }}>Cancel</Button>} />
      : <div className="oc-dashboard-state">
        <DashboardQuiet>Four quick questions, about a minute. Only you see your answers.</DashboardQuiet>
        <Button onClick={() => setOpen(true)}>Answer</Button>
      </div>}
  </DashboardCard>
}
