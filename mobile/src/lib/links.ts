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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  const parts = url.pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part));
  const query = url.searchParams;
  const [first, second, third] = parts;

  // The pre-path form some stored rows still carry: /?workspace=student&view=inbox
  if (!first) return query.get("view") === "inbox" ? { pathname: "/inbox" } : { pathname: "/" };
  if (first === "home") return { pathname: "/" };
  if (first === "inbox") return query.get("tab") === "preferences" ? { pathname: "/settings/notifications" } : { pathname: "/inbox" };
  if (first === "explore" && !second) return { pathname: "/explore" };
  if (first === "calendar") return { pathname: "/calendar" };
  if (first === "profile") return { pathname: "/profile" };

  if (first === "applications") {
    if (second && UUID.test(second)) return third === "decision" ? { pathname: "/decision/[applicationId]", params: { applicationId: second } } : { pathname: "/application/[id]", params: { id: second } };
    return { pathname: "/applications" };
  }
  if (first === "decisions" && second && UUID.test(second)) return { pathname: "/decision/[applicationId]", params: { applicationId: second } };

  if (first === "interviews" && second === "book") {
    const applicationId = query.get("applicationId");
    if (applicationId && UUID.test(applicationId)) return { pathname: "/interview/[applicationId]", params: { applicationId } };
    // Booking links name the club and round; `resolveHref` looks the application up.
    return null;
  }

  if (first === "meetings" && second && UUID.test(second)) return { pathname: "/meeting/[id]", params: { id: second } };
  if (first === "clubs") {
    if (second === "tasks") return { pathname: "/tasks" };
    if (second === "meetings") return { pathname: "/calendar", params: { type: "meeting" } };
    return null;
  }

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
    }
    return null;
  }

  if (first === "voting") {
    const sessionId = second === "rooms" ? third : second;
    const clubId = query.get("clubId");
    if (sessionId && UUID.test(sessionId) && sessionId !== "new") return { pathname: "/voting/[sessionId]", params: { sessionId, ...(clubId && UUID.test(clubId) ? { clubId } : {}) } };
    return null;
  }

  if (first === "settings") {
    if (!second) return { pathname: "/settings" };
    if (second === "account") return { pathname: "/settings/account" };
    if (second === "notifications") return { pathname: "/settings/notifications" };
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
