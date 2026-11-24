/**
 * The emailed reset link (supabase/templates/recovery.html) is https://<site>/reset-password#token_hash=…
 * When it opens the app (lib/app-links.ts on the web claims /reset-password), Expo Router hands the
 * fragment to the screen as the "#" param. The token is single use; it is only ever sent to the
 * server's auth.resetPassword operation and never stored.
 */
type Params = Record<string, string | string[] | undefined>;

const TOKEN = /^[A-Za-z0-9_-]{16,512}$/;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const fromFragment = (fragment: string | undefined) => (fragment ? new URLSearchParams(fragment.replace(/^#/, "")).get("token_hash") : null);

/** The link's own URL, as a fallback when the route params carry no fragment. Only a /reset-password URL counts. */
function fromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return /\/reset-password\/?$/.test(parsed.pathname) ? fromFragment(parsed.hash) : null;
  } catch { return null; }
}

export function resetTokenFrom(params: Params, linkUrl?: string | null): string | null {
  const candidate = fromFragment(first(params["#"])) ?? first(params.token_hash) ?? fromUrl(linkUrl) ?? null;
  return candidate && TOKEN.test(candidate) ? candidate : null;
}

/** A six-digit authenticator code, or nothing when the field is empty. */
export function authenticatorIssue(code: string): string | null {
  return code === "" || /^\d{6}$/.test(code) ? null : "Enter the 6-digit code from your authenticator app.";
}
