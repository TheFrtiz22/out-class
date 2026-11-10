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
    return error ? { saved: false as const } : { saved: true as const }
  } catch {
    return { saved: false as const }
  }
}

export const passwordNotSavedNotice =
  "Your email is confirmed. We couldn't save your password, so sign in with an email code or reset your password."
