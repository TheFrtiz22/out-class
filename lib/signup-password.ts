// The password chosen at signup is stored while the address is still unconfirmed. After the code is
// verified, the confirmed session sets the chosen password again, so the stored password is one written
// by the verified owner. A password change also ends any other session on the account.
type PasswordClient = {
  auth: { updateUser(input: { password: string }): Promise<{ error: { code?: string; status?: number } | null }> }
}

export async function setPasswordAfterConfirmation(client: PasswordClient, password: string | undefined) {
  if (!password) return { saved: false as const }
  try {
    const { error } = await client.auth.updateUser({ password })
    // The stored password may already equal the typed one; Supabase Auth then answers same_password.
    if (!error || error.code === "same_password") return { saved: true as const }
    return { saved: false as const }
  } catch {
    return { saved: false as const }
  }
}

export const passwordNotSavedNotice =
  "Email confirmed. Your password wasn't saved, so sign in with an email code or reset it."

// Allow for clock difference between this server and Supabase Auth when deciding whether the
// verification that just completed is the one that confirmed the address.
const CONFIRMATION_SKEW_MS = 60_000

/** True when the address was confirmed by the verification that started at `startedAt`. */
export function confirmedByThisVerification(user: { email_confirmed_at?: string | null } | null | undefined, startedAt: number) {
  const confirmedAt = Date.parse(user?.email_confirmed_at || "")
  return Number.isFinite(confirmedAt) && confirmedAt >= startedAt - CONFIRMATION_SKEW_MS
}

type ConfirmationClient = PasswordClient & {
  auth: { signOut(input: { scope: "others" }): Promise<{ error: unknown }> }
}

function unusablePassword() {
  // Never returned or stored anywhere: the account signs in with an email code until a password is chosen.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return `${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").slice(0, 60)}aA1!`
}

/**
 * On an account's first email confirmation, only a password supplied by the confirming session is kept,
 * and every other session ends. Without a supplied password the account keeps email-code sign-in and a
 * password can be chosen through password reset.
 */
export async function secureFirstConfirmation(client: ConfirmationClient, password: string | undefined) {
  const saved = (await setPasswordAfterConfirmation(client, password)).saved
  const replaced = saved || (await setPasswordAfterConfirmation(client, unusablePassword())).saved
  let othersSignedOut = false
  try { othersSignedOut = !(await client.auth.signOut({ scope: "others" })).error } catch { othersSignedOut = false }
  return { passwordSaved: saved, secured: replaced && othersSignedOut }
}
