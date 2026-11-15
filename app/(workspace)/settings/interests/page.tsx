import { getMyInterestSurvey } from "@/actions/interest-survey"
import { InterestSettings } from "@/components/interests/interest-settings"
import { requireAuth } from "@/utils/auth"

export const metadata = { title: "Interests" }

/** The signed-in student's own club-interest answers. A support session never reads them. */
export default async function InterestsSettingsPage() {
  const { impersonation } = await requireAuth()
  if (impersonation) return <p className="text-sm text-muted-foreground">Interest answers are private to the student and are not shown in a support session.</p>
  return <InterestSettings initial={await getMyInterestSurvey()} />
}
