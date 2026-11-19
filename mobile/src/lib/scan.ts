import { ApiError, api } from "~/lib/api";
import { shortLinkHosts } from "~/lib/config";
import { resolveHref, type AppRoute } from "~/lib/links";

/**
 * What a scanned QR code means to OutClass. The scanner recognizes one thing and nothing else:
 * a first-party short link, `https://<site>/q/<code>` (check-in, club, voting join, live room).
 * Scanned text is never logged, stored or sent anywhere except to the OutClass API.
 */
const CODE = /^[a-zA-Z0-9_-]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A public club profile's short link carries the club's slug (lib/short-links.ts SHAREABLE_TARGETS).
const CLUB_SLUG = /^\/club\/([a-z0-9][a-z0-9-]{0,79})$/i;

export const isShortLinkCode = (code: string | undefined | null): code is string => !!code && CODE.test(code);

export type Scanned = { kind: "short-link"; code: string } | { kind: "other" };

export function classifyScan(text: string): Scanned {
  const value = text.trim();
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (/^https?:$/.test(url.protocol) && shortLinkHosts.has(url.host) && parts.length === 2 && parts[0] === "q" && isShortLinkCode(parts[1])) return { kind: "short-link", code: parts[1] };
  } catch { /* not a URL */ }
  return { kind: "other" };
}

export type CheckInOutcome = { status: "checked-in" | "already-checked-in"; checkedInAt: string };
export type ScanOutcome =
  | { kind: "check-in"; outcome: CheckInOutcome; meetingId: string }
  | { kind: "check-in-refused"; message: string }
  | { kind: "navigate"; route: AppRoute }
  | { kind: "web"; href: string }
  | { kind: "closed"; message: string }
  | { kind: "unavailable" };

/** The native screen for a short link's site path; anything the app has no screen for opens on the web. */
async function destination(path: string): Promise<ScanOutcome> {
  const slug = CLUB_SLUG.exec(path)?.[1];
  if (slug && !UUID.test(slug)) return { kind: "navigate", route: { pathname: "/club/[id]", params: { id: slug } } };
  const route = await resolveHref(path);
  // A board session's join link (`/voting/<id>/join`) names no club, and the room needs one: the site resolves it.
  if (route?.pathname === "/voting/[sessionId]" && !route.params?.clubId) return { kind: "web", href: path };
  return route ? { kind: "navigate", route } : { kind: "web", href: path };
}

/** Resolves a short-link code and, for a check-in, completes it with the signed-in session: no browser hop. */
export async function redeemShortLink(code: string): Promise<ScanOutcome> {
  if (!isShortLinkCode(code)) return { kind: "unavailable" };
  const resolved = await api.get<{ status: "valid"; target: string } | { status: "closed"; message: string } | { status: "unavailable" }>("shortLinks.resolve", { code });
  if (resolved.status === "closed") return { kind: "closed", message: resolved.message };
  if (resolved.status !== "valid") return { kind: "unavailable" };
  // A check-in target is `/check-in?meetingId=<id>#token=<token>` (lib/short-link-store.ts).
  const target = new URL(resolved.target, "https://outclass.local");
  if (target.pathname === "/check-in") {
    const meetingId = target.searchParams.get("meetingId");
    const token = new URLSearchParams(target.hash.replace(/^#/, "")).get("token");
    if (!meetingId || !token) return { kind: "unavailable" };
    try {
      const outcome = await api.post<CheckInOutcome>("meetings.checkIn", { meetingId, token });
      return { kind: "check-in", outcome, meetingId };
    } catch (error) {
      // The server's own words for a refused check-in (expired code, closed session, alumni account).
      if (error instanceof ApiError && !error.offline && !error.signedOut && error.status >= 400 && error.status < 500) return { kind: "check-in-refused", message: error.message };
      throw error;
    }
  }
  return destination(target.pathname + target.search);
}
