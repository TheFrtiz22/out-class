/** Call only after Auth.getUser has verified this exact access token. Cookie
 * session data alone is not proof of identity. Bind the claim to that user. */
export function sessionIdFromVerifiedToken(token: string, verifiedUserId: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return claims.sub === verifiedUserId && typeof claims.session_id === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)
      ? claims.session_id : null;
  } catch {
    return null;
  }
}
