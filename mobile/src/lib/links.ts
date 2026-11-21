import * as WebBrowser from "expo-web-browser";
import { api } from "~/lib/api";
import { config } from "~/lib/config";

/**
 * Web paths -> native routes. Notifications, short links and push payloads all carry the web's
 * own `href` (a path on the site); this is the one place that decides which native screen shows
 * it. Anything without a native screen returns null and is handed to the site in the in-app
 * browser (`openOnWeb`). Nothing here authorizes anything: every screen loads through the API.
 */
export type AppRoute = { pathname: string; params?: Record<string, string> };

/** The tab screens' paths (src/app/(tabs)). */
export const TAB_PATHS: readonly string[] = ["/", "/explore", "/inbox", "/calendar", "/profile"];
type Navigator = { push(href: never): void; dismissTo(href: never): void };

/**
 * Opens a route from anywhere. A tab goes back down to the tabs at the bottom of the stack and
 * switches to it; pushing a tab path from a screen above them would stack a second copy of the
 * tabs, and that copy's Home showed a Back arrow. Every other screen is pushed.
 */
export function openRoute(router: Navigator, route: AppRoute) {
  if (TAB_PATHS.includes(route.pathname) && !route.params) router.dismissTo(route.pathname as never);
  else router.push(route as never);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_CODE = /^[a-zA-Z0-9_-]{1,32}$/;
const CLUB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
/** An email names the exact letter (`?letterId=`); without it the screen shows the latest one. */
const letterParam = (query: URLSearchParams): { letterId?: string } => { const id = query.get("letterId"); return id && UUID.test(id) ? { letterId: id } : {}; };
const siteHosts = () => new Set(["out-class.net", "www.out-class.net", new URL(config.apiUrl).host]);

/** A site path from an href that is either a path or a full URL on the site. Null for other hosts. */
function sitePath(href: string): URL | null {
  const text = href.trim();
  if (!text) return null;
  try {
    if (text.startsWith("/") && !text.startsWith("//")) return new URL(text, "https://outclass.local");
    const url = new URL(text);
    if (!/^https?:$/.test(url.protocol) || !siteHosts().has(url.host)) return null;
    return new URL(url.pathname + url.search, "https://outclass.local");
  } catch { return null; }
}

/** The native screen for a web path, or null when the app has no screen for it. */
export function routeForHref(href: string | null | undefined): AppRoute | null {
  const url = href ? sitePath(href) : null;
  if (!url) return null;
  let parts: string[];
  // A malformed escape (a stray "%") is not a page the app knows; the site decides what it is.
  try { parts = url.pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part)); } catch { return null; }
  const query = url.searchParams;
  const [first, second, third, fourth] = parts;

  // The pre-path form some stored rows still carry: /?workspace=student&view=inbox
  if (!first) return query.get("view") === "inbox" ? { pathname: "/inbox" } : { pathname: "/" };
  if (first === "home") return { pathname: "/" };
  if (first === "inbox") return query.get("tab") === "preferences" ? { pathname: "/settings/notifications" } : { pathname: "/inbox" };
  if (first === "explore" && !second) return { pathname: "/explore" };
  if (first === "calendar") return { pathname: "/calendar" };
  if (first === "profile") return { pathname: "/profile" };
  if (first === "saved-clubs" && !second) return { pathname: "/saved-clubs" };
  // The campus events board; `?event=<id>` is one event (the link the share sheet and the web use).
  if (first === "corkboard" && !second) {
    const event = query.get("event");
    return event && UUID.test(event) ? { pathname: "/events/[id]", params: { id: event } } : { pathname: "/events" };
  }
  // A first-party short link (check-in, club, voting join) resolves in the app, as a scan would.
  if (first === "q" && second && !third) return SHORT_CODE.test(second) ? { pathname: "/q/[code]", params: { code: second } } : null;

  if (first === "applications") {
    if (second && UUID.test(second)) return third === "decision" ? { pathname: "/decision/[applicationId]", params: { applicationId: second, ...letterParam(query) } } : { pathname: "/application/[id]", params: { id: second } };
    return { pathname: "/applications" };
  }
  if (first === "decisions" && second && UUID.test(second)) return { pathname: "/decision/[applicationId]", params: { applicationId: second, ...letterParam(query) } };

  if (first === "interviews" && second === "book") {
    const applicationId = query.get("applicationId");
    if (applicationId && UUID.test(applicationId)) return { pathname: "/interview/[applicationId]", params: { applicationId } };
    // Booking links name the club and round; `resolveHref` looks the application up.
    return null;
  }

  if (first === "meetings") {
    if (!second) return { pathname: "/calendar", params: { type: "meeting" } };
    return UUID.test(second) && !third ? { pathname: "/meeting/[id]", params: { id: second } } : null;
  }
  if (first === "clubs") {
    if (second === "tasks") return { pathname: "/tasks" };
    if (second === "meetings") return { pathname: "/calendar", params: { type: "meeting" } };
    return null;
  }

  // A club's public page by slug (club QR codes and shared links); the club screen loads either form.
  if (first === "club" && second && !third && !UUID.test(second) && CLUB_SLUG.test(second)) return { pathname: "/club/[id]", params: { id: second } };
  if (first === "club" && second && UUID.test(second)) {
    if (!third) return { pathname: "/club/[id]", params: { id: second } };
    if (third === "tasks") return { pathname: "/tasks", params: { clubId: second } };
    if (third === "workspace") {
      const section = query.get("section");
      if (section === "tasks") {
        const taskId = query.get("taskId");
        // A manager's task view has no native screen; a member's own task does.
        if (query.get("taskView") === "manage") return null;
        return { pathname: "/tasks", params: { clubId: second, ...(taskId && UUID.test(taskId) ? { taskId } : {}) } };
      }
      if (!section || section === "overview" || section === "calendar") return { pathname: "/my-club/[clubId]", params: { clubId: second } };
      // Recruitment lists a leader works from. A link to one applicant, room or letter stays on the
      // web, which opens that exact item; the server still decides who may see each screen.
      if (section === "recruitment") {
        const tool = query.get("tool");
        const specific = ["applicantId", "applicationId", "bookingId", "roomId", "slotId", "reviewId", "documentId"].some(key => query.has(key));
        if (specific) return null;
        if (tool === "applicants" && !query.has("recruitingSettings")) return { pathname: "/leader/[clubId]/applicants", params: { clubId: second } };
        if (tool === "interviews") return { pathname: "/leader/[clubId]/interviews", params: { clubId: second } };
        if (tool === "decisions" && (query.get("decisionTab") ?? "voting") === "voting") return { pathname: "/leader/[clubId]/voting", params: { clubId: second } };
      }
    }
    return null;
  }

  if (first === "voting") {
    // /voting/<id>/join and /voting/rooms/<id> open the room. Preparing a room, starting one and a
    // retired session's history are web pages. The room screen needs the club, so a link without one goes to the site.
    const room = second === "rooms";
    const sessionId = room ? third : second;
    const rest = room ? fourth : third;
    const clubId = query.get("clubId");
    if (!sessionId || !UUID.test(sessionId) || !clubId || !UUID.test(clubId)) return null;
    if (room ? rest !== undefined : rest !== undefined && rest !== "join") return null;
    return { pathname: "/voting/[sessionId]", params: { sessionId, clubId } };
  }

  if (first === "settings") {
    if (!second) return { pathname: "/settings" };
    if (second === "account") return { pathname: "/settings/account" };
    if (second === "notifications") return { pathname: "/settings/notifications" };
    if (second === "interests") return { pathname: "/settings/interests" };
    // A published panel lists under Interview schedule; an availability request opens on its round.
    if (second === "interviews") return { pathname: "/settings/interviews" };
    if (second === "availability") {
      const roundId = query.get("roundId");
      return roundId && UUID.test(roundId) ? { pathname: "/settings/availability", params: { roundId } } : { pathname: "/settings/availability" };
    }
    if (second === "profile") return { pathname: "/profile" };
    return null;
  }
  return null;
}

/**
 * `routeForHref`, plus the one link that needs a lookup: an interview booking link names the club
 * and round, and the server says which of the person's applications it is for.
 */
export async function resolveHref(href: string | null | undefined): Promise<AppRoute | null> {
  const direct = routeForHref(href);
  if (direct || !href) return direct;
  const url = sitePath(href);
  if (!url || url.pathname !== "/interviews/book") return null;
  const clubId = url.searchParams.get("clubId"), roundId = url.searchParams.get("roundId");
  if (!clubId || !roundId || !UUID.test(clubId) || !UUID.test(roundId)) return null;
  try {
    const booking = await api.get<{ id?: string; applicationId?: string; application?: { id?: string } } | null>("interviews.booking", { clubId, roundId });
    const applicationId = booking?.applicationId ?? booking?.application?.id ?? booking?.id;
    return applicationId && UUID.test(applicationId) ? { pathname: "/interview/[applicationId]", params: { applicationId } } : null;
  } catch { return null; }
}

/** The full site address for a web path (only ever the configured site). */
export function webUrl(href: string): string | null {
  const url = sitePath(href);
  return url ? config.apiUrl + url.pathname + url.search : null;
}

/** "Open on web": the site in the in-app browser, for pages the app has no screen for. */
export async function openOnWeb(href: string): Promise<boolean> {
  const url = webUrl(href);
  if (!url) return false;
  try { await WebBrowser.openBrowserAsync(url); return true; } catch { return false; }
}

/** An outside address a club supplied (a meeting resource, a LinkedIn profile). http(s) only. */
export async function openExternal(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  try { await WebBrowser.openBrowserAsync(url); return true; } catch { return false; }
}
