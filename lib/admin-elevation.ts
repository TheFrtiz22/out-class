export const ADMIN_ELEVATION_COOKIE = "outclass-admin-elevation";
export const ADMIN_CHALLENGE_COOKIE = "outclass-admin-challenge";
// Fresh verification gates sensitive actions, not the lifetime of Admin access.
export const ADMIN_ACTION_VERIFICATION_WINDOW = 5 * 60 * 1000;
export const ADMIN_CHALLENGE_LIFETIME = 5 * 60 * 1000;
export const adminCookieOptions = { path: "/", httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production" };
export function validAdminElevation(row: {
  actorId: string; authSessionId: string; revokedAt: Date | null; expiresAt: Date | null;
  passwordVerifiedAt: Date; mfaVerifiedAt: Date;
} | null, actorId: string, authSessionId: string, now = new Date()) {
  return !!row && row.actorId === actorId && row.authSessionId === authSessionId && !row.revokedAt
    && (row.expiresAt === null || row.expiresAt > now) && row.passwordVerifiedAt <= row.mfaVerifiedAt && row.mfaVerifiedAt <= now;
}

export function freshAdminVerification(row: { passwordVerifiedAt: Date; mfaVerifiedAt: Date }, now = new Date()) {
  const cutoff = now.getTime() - ADMIN_ACTION_VERIFICATION_WINDOW;
  return row.passwordVerifiedAt.getTime() >= cutoff && row.passwordVerifiedAt <= row.mfaVerifiedAt
    && row.mfaVerifiedAt <= now;
}
