/** The Applicants layout (List · Kanban · Ranked), kept in the URL as `applicantView=` so a view is linkable and survives reload. List is the default and stays out of the URL. */
export const applicantViews = ["list", "kanban", "ranked"] as const
export type ApplicantView = typeof applicantViews[number]
export const APPLICANT_VIEW_PARAM = "applicantView"

export function readApplicantView(params: { get(name: string): string | null }): ApplicantView {
  const value = params.get(APPLICANT_VIEW_PARAM)
  return applicantViews.includes(value as ApplicantView) ? value as ApplicantView : "list"
}

export function writeApplicantView(url: URL, view: ApplicantView) {
  if (view === "list") url.searchParams.delete(APPLICANT_VIEW_PARAM)
  else url.searchParams.set(APPLICANT_VIEW_PARAM, view)
  return url
}
