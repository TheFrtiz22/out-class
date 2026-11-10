/**
 * Focus routes: single-task screens that render inside the focus frame
 * (app/(focus)/layout.tsx) instead of the product shell. Each has a task name,
 * and a content width. A screen can refine both with useFocusFrame (the voting room does, per
 * view); the projector view renders `data-theme="present"` and the frame follows it in CSS.
 */
export type FocusWidth = "reading" | "content" | "full"
export type FocusRoute = { task: string; width: FocusWidth }

export const FOCUS_EXIT_FALLBACK = "/home"
/** sessionStorage key the product shell writes so Exit returns to the last product page. */
export const LAST_PRODUCT_ROUTE_KEY = "outclass.last-product-route"

const segment = "[^/]+"
const routes: [RegExp, () => FocusRoute][] = [
  [/^\/(live-voting|vote)\/?$/, () => ({ task: "Live voting", width: "reading" })],
  [new RegExp(`^/voting/${segment}/join$`), () => ({ task: "Join voting", width: "content" })],
  [/^\/voting\/rooms\/new$/, () => ({ task: "Set up voting", width: "content" })],
  [new RegExp(`^/voting/rooms/${segment}/prepare$`), () => ({ task: "Prepare slides", width: "content" })],
  [new RegExp(`^/voting/rooms/${segment}$`), () => ({ task: "Live voting", width: "reading" })],
  [/^\/check-in$/, () => ({ task: "Meeting check-in", width: "reading" })],
  [/^\/interviews\/book$/, () => ({ task: "Book your interview", width: "content" })],
  [new RegExp(`^/applications/${segment}/decision$`), () => ({ task: "Decision letter", width: "content" })],
  [new RegExp(`^/club/${segment}/interview$`), () => ({ task: "Interview", width: "full" })],
  [new RegExp(`^/q/${segment}$`), () => ({ task: "Check-in link", width: "reading" })],
  [/^\/auth\/student-claim$/, () => ({ task: "Claim your account", width: "reading" })],
  [/^\/platform\/login$/, () => ({ task: "Admin sign-in", width: "reading" })],
]

export function focusRouteFor(pathname: string): FocusRoute | null {
  for (const [pattern, route] of routes) if (pattern.test(pathname)) return route()
  return null
}

export function isFocusPath(pathname: string) {
  return focusRouteFor(pathname) !== null
}

/** The voting room's task and width for each view; the projector is full width. */
export function votingRoomFocus(view: "member" | "leader" | "present"): FocusRoute {
  return view === "present" ? { task: "Presentation", width: "full" } : view === "leader" ? { task: "Voting controls", width: "content" } : { task: "Live voting", width: "reading" }
}

/** A same-origin product path, or null. Never an external, protocol-relative or focus URL. */
export function safeExitHref(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null
  try {
    const url = new URL(value, "https://out-class.net")
    if (url.origin !== "https://out-class.net" || isFocusPath(url.pathname)) return null
    return url.pathname + url.search + url.hash
  } catch { return null }
}
