import { requireAuth } from "@/utils/auth"
import { AccountSettings } from "@/components/settings/account-settings"
import { userMfaEnabled, verifiedFactorCount } from "@/lib/user-mfa"

export const metadata = { title: "Account & Security" }
export default async function AccountSettingsPage() {
  const { user, supabaseUser, impersonation } = await requireAuth({ verifyEmail: true })
  const providers = supabaseUser.app_metadata?.providers
  const passwordAccount = Array.isArray(providers) ? providers.includes("email") : supabaseUser.app_metadata?.provider === "email"
  // Hidden until the server flag is on. Factors come from the verified Auth user (never in support sessions).
  const twoStep = userMfaEnabled() ? {
    enabled: !impersonation && verifiedFactorCount(supabaseUser as { factors?: { status?: string }[] }) > 0,
    required: (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(v => v.trim()).includes(user.id),
  } : null
  return <AccountSettings email={user.email} passwordAccount={passwordAccount} impersonating={!!impersonation} twoStep={twoStep} />
}
