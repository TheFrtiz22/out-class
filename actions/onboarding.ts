"use server"

import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { registrationSchema } from "@/lib/onboarding-schemas"
import { authEmailError } from "@/lib/auth-email"

/** Normal signup always requires Supabase email confirmation, in every environment. */
export async function registerStudent(input: unknown) {
  const cookieStore = await cookies()
  if (cookieStore.has(PLATFORM_VIEW_COOKIE)) return { error: "Exit impersonation before registering an account." }
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { email, password, firstName, lastName } = parsed.data
  const supabase = await createClient(cookieStore)
  try {
    // Fail closed before creating a user if this project's confirmation policy is unsafe.
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return { error: "Unable to check email verification settings. Please try again." }
    const settings = await response.json()
    if (settings.mailer_autoconfirm !== false || settings.external?.email !== true) {
      return { error: "Account registration is temporarily unavailable. Contact OutClass support." }
    }
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { first_name: firstName, last_name: lastName } },
    })
    if (error) return { error: authEmailError(error, "send") }
    if (data.user?.identities?.length === 0) return { error: "An account may already exist for this email. Please sign in instead." }
    if (data.session || data.user?.email_confirmed_at) {
      await supabase.auth.signOut()
      return { error: "Account registration is temporarily unavailable. Contact OutClass support." }
    }
    if (!data.user) return { error: "Unable to create your account. Please try again." }
    return { authenticated: false }
  } catch {
    return { error: "Unable to reach the account service. Please try again." }
  }
}
