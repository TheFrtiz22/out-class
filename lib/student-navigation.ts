import type { ViewId } from "@/lib/views"
import type { PersonalSection } from "@/lib/product-navigation"

const studentViews = ["student-dashboard", "inbox", "student-profile", "explore", "corkboard", "my-clubs", "calendar", "tracker"] as const
/** Legacy bookmarks resolve only here; they never create additional views or navigation entries. */
export function resolveStudentView(value: string | null): ViewId | null {
  const canonical = ["discover", "discovery", "categories"].includes(value?.toLowerCase() || "") ? "explore" : value
  return studentViews.includes(canonical as typeof studentViews[number]) ? canonical as ViewId : null
}
export function sectionForStudentView(view: ViewId, section: string | null): PersonalSection {
  if (view === "tracker") return ["applications", "interviews", "decisions"].includes(section || "") ? section as PersonalSection : "applications"
  if (view === "my-clubs") return ["clubs", "meetings", "tasks"].includes(section || "") ? section as PersonalSection : "clubs"
  if (view === "calendar") return "calendar"
  return view === "corkboard" ? "corkboard" : "explore"
}
