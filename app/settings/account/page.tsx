import { requireAuth } from "@/utils/auth"
import { AccountSettings } from "@/components/settings/account-settings"
export default async function AccountSettingsPage() {
  const { user, supabaseUser, impersonation } = await requireAuth({ verifyEmail: true })
  const providers = supabaseUser.app_metadata?.providers
  const passwordAccount = Array.isArray(providers) ? providers.includes("email") : supabaseUser.app_metadata?.provider === "email"
  return <AccountSettings email={user.email} passwordAccount={passwordAccount} impersonating={!!impersonation} />
}
