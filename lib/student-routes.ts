import type { ViewId } from "@/lib/views"
import type { PersonalSection } from "@/lib/product-navigation"
import { studentRoute } from "@/lib/student-navigation"

/**
 * One registry for the personal (student) workspace: every view has a real path.
 * Old homepage URLs (`/?workspace=student&view=…`) are redirected here by
 * middleware; they live on in stored notifications and sent email, so the
 * redirect is permanent.
 */
export type StudentRoute = { path: string; view: ViewId; section: PersonalSection; label: string }

export const STUDENT_ROUTES: readonly StudentRoute[] = [
  { path: "/home", view: "student-dashboard", section: "explore", label: "Home" },
  { path: "/explore", view: "explore", section: "explore", label: "Explore" },
  { path: "/explore/categories", view: "explore", section: "categories", label: "Categories" },
  { path: "/corkboard", view: "corkboard", section: "corkboard", label: "Corkboard" },
  { path: "/applications", view: "tracker", section: "applications", label: "Applications" },
  { path: "/applications/status", view: "status", section: "status", label: "Status" },
  { path: "/clubs", view: "my-clubs", section: "clubs", label: "My Clubs" },
  { path: "/clubs/meetings", view: "my-clubs", section: "meetings", label: "Meetings" },
  { path: "/clubs/tasks", view: "my-clubs", section: "tasks", label: "Tasks" },
  { path: "/calendar", view: "calendar", section: "explore", label: "Calendar" },
  { path: "/inbox", view: "inbox", section: "explore", label: "Notifications" },
  { path: "/profile", view: "student-profile", section: "explore", label: "Profile" },
]

export const STUDENT_HOME = "/home"

/** Parameters encoded by the path itself; everything else (focus ids, tabs, demoClub) is carried over. */
const ROUTING_PARAMS = ["workspace", "view", "section"]

function routeFor(view: ViewId, section: PersonalSection): StudentRoute {
  if (view === "calendar") return STUDENT_ROUTES.find(route => route.view === "calendar")!
  return STUDENT_ROUTES.find(route => route.view === view && route.section === section)
    ?? STUDENT_ROUTES.find(route => route.view === view)
    ?? STUDENT_ROUTES[0]
}

/** Canonical href for a student view. Calendar keeps its originating tab as `?section=`. */
export function studentPath(view: ViewId, section?: PersonalSection | null, carry?: URLSearchParams | Record<string, string>): string {
  const resolved = studentRoute(view, section ?? null)
  const route = resolved ? routeFor(resolved.view, resolved.section) : STUDENT_ROUTES[0]
  const params = new URLSearchParams(carry)
  ROUTING_PARAMS.forEach(key => params.delete(key))
  if (route.view === "calendar" && resolved && !["explore", "corkboard"].includes(resolved.section)) params.set("section", resolved.section)
  const query = params.toString()
  return query ? `${route.path}?${query}` : route.path
}

/** The student view a path renders, or null when the path is not a student route. */
export function studentRouteForPath(pathname: string, params?: URLSearchParams): { view: ViewId; section: PersonalSection } | null {
  const route = STUDENT_ROUTES.find(entry => entry.path === pathname)
  if (!route) return null
  if (route.view === "calendar") return studentRoute("calendar", params?.get("section") ?? null)
  return { view: route.view, section: route.section }
}

/**
 * Map an old homepage workspace URL to its path, preserving other parameters.
 * Returns null when the URL is not a student workspace URL (landing, sign-in,
 * leader workspace and demo entry URLs keep their current behavior).
 */
export function legacyStudentRedirect(params: URLSearchParams): string | null {
  const view = params.get("view")
  const route = studentRoute(view, params.get("section"))
  if (route) return studentPath(route.view, route.section, params)
  // Unknown or leader-only views under the student workspace open Home, as they do today.
  return params.get("workspace") === "student" ? studentPath("student-dashboard", null, params) : null
}

/** Applicant Status, keeping focus ids (/interviews and /decisions redirect here). */
export function applicantStatusHref(input = new URLSearchParams()) {
  return studentPath("status", "status", input)
}

/**
 * Leader views that used to render on the homepage (`/?view=leader-dashboard`, …) live in the
 * club workspace. Same mapping the client used (DashboardLayout); `applicantId`/`roundId` carry over.
 */
export const LEADER_WORKSPACE_VIEWS = ["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages", "screening-dashboard", "club-management-portal"] as const
export type LeaderWorkspaceView = typeof LEADER_WORKSPACE_VIEWS[number]
export function isLeaderWorkspaceView(view: string | null | undefined): view is LeaderWorkspaceView {
  return LEADER_WORKSPACE_VIEWS.includes(view as LeaderWorkspaceView)
}
export function leaderWorkspaceHref(view: LeaderWorkspaceView, clubId: string, focus: { applicantId?: string | null; roundId?: string | null } = {}) {
  const section = view === "club-manager" || view === "club-management-portal" ? "settings" : view === "broadcast-messages" ? "announcements" : "recruitment"
  const query = new URLSearchParams({ section })
  if (section === "recruitment") query.set("tool", view === "interview-scheduler" ? "interviews" : view === "screening-dashboard" ? "rules" : "applicants")
  if (focus.applicantId) query.set("applicantId", focus.applicantId)
  if (focus.roundId) query.set("roundId", focus.roundId)
  return `/club/${encodeURIComponent(clubId)}/workspace?${query}`
}
