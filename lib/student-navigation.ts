import type { ViewId } from "@/lib/views"
import type { PersonalSection } from "@/lib/product-navigation"

const studentViews = ["student-dashboard", "inbox", "student-profile", "explore", "corkboard", "my-clubs", "calendar", "tracker", "status"] as const
/** Applicant aliases only; club/admin routes never pass through this resolver. */
export function resolveStudentView(value: string | null): ViewId | null {
  const alias = value?.toLowerCase() || ""
  const canonical = ["discover", "discovery", "categories"].includes(alias) ? "explore" : ["interviews", "decisions"].includes(alias) ? "status" : value
  return studentViews.includes(canonical as typeof studentViews[number]) ? canonical as ViewId : null
}
export function sectionForStudentView(view: ViewId, section: string | null): PersonalSection {
  if (view === "status") return "status"
  if (view === "tracker") return ["status", "interviews", "decisions"].includes(section || "") ? "status" : "applications"
  if (view === "my-clubs") return ["clubs", "meetings", "tasks"].includes(section || "") ? section as PersonalSection : "clubs"
  if (view === "calendar") return "calendar"
  return view === "corkboard" ? "corkboard" : "explore"
}
export function studentRoute(value: string | null, section: string | null) {
  let view = resolveStudentView(value)
  if (!view) return null
  const active = sectionForStudentView(view, value?.toLowerCase() === "categories" ? "categories" : section)
  if (view === "tracker" && active === "status") view = "status"
  return { view, section: active }
}
/** Preserve focus IDs and all other parameters when canonicalizing old bookmarks. */
export function canonicalStudentParams(input: URLSearchParams) {
  const route = studentRoute(input.get("view"), input.get("section"))
  if (!route) return null
  const params = new URLSearchParams(input)
  params.set("view", route.view)
  if (route.section === "explore" || route.section === "corkboard") params.delete("section")
  else if (!["student-dashboard", "inbox", "student-profile"].includes(route.view)) params.set("section", route.section)
  else params.delete("section")
  return { ...route, params }
}
export function applicantStatusHref(input = new URLSearchParams()) {
  const params = new URLSearchParams(input)
  params.set("workspace", "student"); params.set("view", "status"); params.set("section", "status")
  return `/?${params}`
}
