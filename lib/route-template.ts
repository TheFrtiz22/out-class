/**
 * Every page route in `app/`, as its template (route groups removed). `tests/web-vitals.test.cjs`
 * fails when a page is added or removed without updating this list.
 */
export const PAGE_ROUTE_TEMPLATES = [
  "/", "/about", "/applications", "/applications/[applicationId]/decision", "/applications/status",
  "/auth/student-claim", "/auth/two-step", "/calendar", "/check-in", "/club-access/[clubId]", "/club-claims/[clubId]",
  "/club/[clubId]", "/club/[clubId]/interview", "/club/[clubId]/tasks", "/club/[clubId]/workspace",
  "/clubs", "/clubs/meetings", "/clubs/tasks", "/cookies", "/corkboard", "/decisions", "/design-system",
  "/explore", "/explore/categories", "/forgot-password", "/home", "/inbox", "/interviews", "/interviews/book",
  "/invitations/[id]", "/legal", "/live-voting", "/login", "/meetings", "/meetings/[id]",
  "/platform", "/platform/[section]", "/platform/claims", "/platform/clubs", "/platform/events", "/platform/login",
  "/platform/school-requests", "/platform/view-as", "/preview", "/privacy", "/profile", "/q/[code]",
  "/request-school", "/reset-password", "/saved-clubs", "/settings", "/settings/account", "/settings/availability",
  "/settings/interests", "/settings/interviews", "/settings/notifications", "/settings/organizations", "/settings/profile", "/signup",
  "/terms", "/universities", "/uva", "/vote", "/voting/[sessionId]/join", "/voting/rooms/[sessionId]",
  "/voting/rooms/[sessionId]/history", "/voting/rooms/[sessionId]/prepare", "/voting/rooms/new",
] as const

export type RouteTemplate = (typeof PAGE_ROUTE_TEMPLATES)[number] | "other"

const parsed = PAGE_ROUTE_TEMPLATES.map(template => ({ template, segments: template.split("/").filter(Boolean) }))

/**
 * The route template a pathname renders (`/club/abc` → `/club/[clubId]`), never the pathname itself:
 * IDs, slugs and share codes are replaced by the template's parameter names. A path that matches no
 * page is "other". Static segments win over dynamic ones (`/voting/rooms/new`, `/platform/claims`).
 */
export function routeTemplate(pathname: string): RouteTemplate {
  const cut = pathname.search(/[?#]/)
  const segments = (cut === -1 ? pathname : pathname.slice(0, cut)).split("/").filter(Boolean)
  let best: { template: RouteTemplate; fixed: number } | null = null
  for (const route of parsed) {
    if (route.segments.length !== segments.length) continue
    let fixed = 0, ok = true
    for (let i = 0; i < segments.length && ok; i++) {
      if (route.segments[i]!.startsWith("[")) continue
      if (route.segments[i] === segments[i]) fixed++
      else ok = false
    }
    if (ok && (!best || fixed > best.fixed)) best = { template: route.template, fixed }
  }
  return best?.template ?? "other"
}
