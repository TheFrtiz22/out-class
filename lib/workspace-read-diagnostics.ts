// Local observers receive only fixed event labels, never identities, tokens,
// cookies, filter values, request arguments or authorization results. No buffer.
export const workspaceReadCauses = ["mount", "dispatch", "user", "readAuthority", "isImpersonating", "clubId", "kind", "privacyScope", "retry", "mode", "demoReady", "demoEnabled", "initial_session", "signed_in", "signed_out", "token_refreshed", "user_updated", "mfa_challenge_verified", "password_recovery"] as const
export function recordWorkspaceRead(kind: "auth" | "selected" | "page", causes: readonly string[]) {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined" || typeof window.dispatchEvent !== "function") return
  if (!["auth", "selected", "page"].includes(kind)) return
  const safe = causes.filter(cause => workspaceReadCauses.includes(cause as typeof workspaceReadCauses[number]))
  try { window.dispatchEvent(new CustomEvent("outclass:workspace-read", { detail: { kind, causes: safe } })) } catch { /* Diagnostics must never block an authority change or a read. */ }
}
