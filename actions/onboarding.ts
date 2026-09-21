"use server"

import { cookies } from "next/headers"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/server"
import { registrationSchema } from "@/lib/onboarding-schemas"

/** Only creates new accounts; never confirms or changes an existing account. */
export async function registerStudent(input: unknown, skipVerification: boolean) {
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { email, password, firstName, lastName } = parsed.data
  const supabase = await createClient(await cookies())
  const metadata = { first_name: firstName, last_name: lastName }
  try {
    if (skipVerification) {
      const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      if (secret && process.env.ALLOW_UNVERIFIED_SIGNUP === "true") {
        const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: metadata,
          app_metadata: { email_verification_skipped: true },
        })
        if (error) return { error: "Could not create this account. If you already registered, sign in instead." }
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) return { error: "Your account was created. Please sign in to finish your profile." }
        return { authenticated: true }
      }
      // Check before signup so skipping never depends on sending an email.
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        cache: "no-store", signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) return { error: "Unable to check email settings. Please try again." }
      const settings = await response.json()
      if (!settings.mailer_autoconfirm) {
        return { error: "Email verification is still required by this Supabase project. Disable Confirm email in Supabase to enable signup without email delivery." }
      }
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } })
    if (error) return { error: error.message }
    if (data.user?.identities?.length === 0) return { error: "An account may already exist for this email. Please sign in instead." }
    return { authenticated: !!data.session }
  } catch {
    return { error: "Unable to reach the account service. Please try again." }
  }
}
