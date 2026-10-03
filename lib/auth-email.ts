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

export function confirmedEmailSession(data: {
  session: { user: { id: string } } | null;
  user: { id: string; email?: string; email_confirmed_at?: string | null } | null;
}, email: string) {
  return !!data.session && !!data.user && data.session.user.id === data.user.id &&
    data.user.email?.toLowerCase() === email.trim().toLowerCase() && isUvaEmail(data.user.email) &&
    Number.isFinite(Date.parse(data.user.email_confirmed_at || ""))
}
