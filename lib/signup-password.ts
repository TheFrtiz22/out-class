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
    // Until the confirmation step clears the stored password, it still equals the typed one.
    if (!error || error.code === "same_password") return { saved: true as const }
    return { saved: false as const }
  } catch {
    return { saved: false as const }
  }
}

export const passwordNotSavedNotice =
  "Email confirmed. Your password wasn't saved, so sign in with an email code or reset it."
