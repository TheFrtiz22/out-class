import { api } from "~/lib/api";
import { shortLinkHosts } from "~/lib/config";
import { resolveHref, type AppRoute } from "~/lib/links";

/**
 * What a scanned QR code means to OutClass. The scanner recognizes one thing and nothing else:
 * a first-party short link, `https://<site>/q/<code>` (check-in, club, voting join, live room).
 * Scanned text is never logged, stored or sent anywhere except to the OutClass API.
 */
const CODE = /^[a-zA-Z0-9_-]{1,32}$/;

export type Scanned = { kind: "short-link"; code: string } | { kind: "other" };

export function classifyScan(text: string): Scanned {
  const value = text.trim();
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (/^https?:$/.test(url.protocol) && shortLinkHosts.has(url.host) && parts.length === 2 && parts[0] === "q" && CODE.test(parts[1]!)) return { kind: "short-link", code: parts[1]! };
  } catch { /* not a URL */ }
  return { kind: "other" };
}

export type CheckInOutcome = { status: "checked-in" | "already-checked-in"; checkedInAt: string };
export type ScanOutcome =
  | { kind: "check-in"; outcome: CheckInOutcome; meetingId: string }
  | { kind: "navigate"; route: AppRoute }
  | { kind: "closed"; message: string }
  | { kind: "unavailable" };

/** Resolves a short-link code and, for a check-in, completes it with the signed-in session: no browser hop. */
export async function redeemShortLink(code: string): Promise<ScanOutcome> {
  const resolved = await api.get<{ status: "valid"; target: string } | { status: "closed"; message: string } | { status: "unavailable" }>("shortLinks.resolve", { code });
  if (resolved.status === "closed") return { kind: "closed", message: resolved.message };
  if (resolved.status !== "valid") return { kind: "unavailable" };
  // A check-in target is `/check-in?meetingId=<id>#token=<token>` (lib/short-link-store.ts).
  const target = new URL(resolved.target, "https://outclass.local");
  if (target.pathname === "/check-in") {
    const meetingId = target.searchParams.get("meetingId");
    const token = new URLSearchParams(target.hash.replace(/^#/, "")).get("token");
    if (!meetingId || !token) return { kind: "unavailable" };
    const outcome = await api.post<CheckInOutcome>("meetings.checkIn", { meetingId, token });
    return { kind: "check-in", outcome, meetingId };
  }
  const route = await resolveHref(target.pathname + target.search);
  return route ? { kind: "navigate", route } : { kind: "unavailable" };
}
