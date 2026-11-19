/**
 * Door mode: the personal check-in pass (docs/qr-attendance.md, "Door mode").
 *
 * The QR a student shows holds `OCP1.<token>`: a version tag and 32 random bytes in hex. It is not
 * a link, so a phone camera or another app cannot open anything with it; only the in-app leader
 * scanner sends it to the server. The token is identity-bound on the server (the row names the
 * student), lives for seconds and is redeemed once.
 */
export const CHECK_IN_PASS_PREFIX = "OCP1.";
/** A pass is valid this long after it is issued. */
export const CHECK_IN_PASS_LIFETIME_MS = 45_000;
/** The app asks for a fresh pass this often, so the code on screen always has time left. */
export const CHECK_IN_PASS_REFRESH_SECONDS = 25;
/** Unexpired passes one account may hold: enough for a refresh that overlaps, no more. */
export const CHECK_IN_PASS_MAX_LIVE = 3;

const TOKEN = /^[a-f0-9]{64}$/;

export function checkInPassPayload(token: string): string {
  return `${CHECK_IN_PASS_PREFIX}${token}`;
}

/** The token inside a scanned pass payload, or null for anything else (a link, another QR code). */
export function parseCheckInPass(payload: unknown): string | null {
  if (typeof payload !== "string" || payload.length !== CHECK_IN_PASS_PREFIX.length + 64 || !payload.startsWith(CHECK_IN_PASS_PREFIX)) return null;
  const token = payload.slice(CHECK_IN_PASS_PREFIX.length);
  return TOKEN.test(token) ? token : null;
}

export type DoorScanResult =
  | { status: "checked-in" | "already-checked-in"; checkedInAt: string; name: string | null }
  | { status: "not-eligible" };
