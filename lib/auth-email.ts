import { isUvaEmail } from "@/lib/auth"

export function authEmailError(error: { code?: string; status?: number }, operation: "send" | "verify") {
  if (error.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code || "")) {
    return "Too many attempts. Wait a few minutes before trying again."
  }
  // Supabase deliberately combines incorrect, expired and consumed tokens under otp_expired.
  if (error.code === "otp_expired") return "That code isn't valid or has expired. Check it or send yourself a new one."
  if (operation === "verify") return "That code isn't valid. Check the code and try again."
  return "Unable to send a code. Please try again in a moment."
}

// Sign-in codes are requested with shouldCreateUser:false, so Supabase Auth answers an address with no
// account with otp_disabled (422). The sign-in screen treats that exactly like a sent code.
export function isNoAccountCodeError(error: { code?: string; status?: number }) {
  return error.code === "otp_disabled" && (error.status === 400 || error.status === 422)
}

export function signInCodeNotice(email: string) {
  return `If ${email} has an OutClass account, we sent it a 6-digit code.`
}

export function confirmedEmailSession(data: {
  session: { user: { id: string } } | null;
  user: { id: string; email?: string; email_confirmed_at?: string | null } | null;
}, email: string) {
  return !!data.session && !!data.user && data.session.user.id === data.user.id &&
    data.user.email?.toLowerCase() === email.trim().toLowerCase() && isUvaEmail(data.user.email) &&
    Number.isFinite(Date.parse(data.user.email_confirmed_at || ""))
}

export type EmailCodeResult =
  | { ok: true; firstConfirmation: boolean; passwordSaved: boolean }
  | { ok: false; error: string }

/** Verifies an email code through /api/auth/confirm-email, which attaches the session to this browser. */
export async function confirmEmailCode(email: string, code: string, password?: string, request: typeof fetch = fetch): Promise<EmailCodeResult> {
  try {
    const response = await request("/api/auth/confirm-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: email.trim().toLowerCase(), code, ...(password ? { password } : {}) }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body.success !== true) {
      return { ok: false, error: typeof body.error === "string" ? body.error : "Unable to verify this code. Please try again." }
    }
    return { ok: true, firstConfirmation: body.firstConfirmation === true, passwordSaved: body.passwordSaved === true }
  } catch {
    return { ok: false, error: "Unable to verify this code. Check your connection and try again." }
  }
}
