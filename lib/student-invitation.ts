import { createHash } from "node:crypto";

// This digest cannot be redeemed at Auth. It binds an administrator-issued link
// to an application account without copying the provider's bearer capability.
export function studentInvitationFingerprint(tokenHash: string): string {
  if (!/^[a-f0-9]{56,64}$/.test(tokenHash)) throw Error("Invalid student invitation.");
  return createHash("sha256").update("outclass-student-invite-v1\0").update(tokenHash).digest("hex");
}
