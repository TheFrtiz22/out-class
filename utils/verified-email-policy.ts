export function hasConfirmedUniversityEmail(account: {
  user: { id: string; email: string };
  supabaseUser: { id: string; email?: string; email_confirmed_at?: string | null; confirmation_sent_at?: string | null; app_metadata?: Record<string, unknown> };
}) {
  const { user, supabaseUser: auth } = account;
  const sent = Date.parse(auth.confirmation_sent_at || "");
  const confirmed = Date.parse(auth.email_confirmed_at || "");
  return auth.id === user.id && auth.email?.trim().toLowerCase() === user.email.trim().toLowerCase() &&
    auth.app_metadata?.email_verification_skipped !== true && Number.isFinite(sent) && Number.isFinite(confirmed) && confirmed >= sent;
}

/** Auto-confirmed Auth timestamps do not prove control of a university mailbox. */
export async function requireVerifiedEmailPolicy() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("University email verification is unavailable.");
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || (await response.json()).mailer_autoconfirm !== false) {
      throw new Error("Email confirmation must be enabled before university invitations can be claimed.");
    }
  } catch {
    throw new Error("University invitations require an available Auth service with email confirmation enabled.");
  }
}
