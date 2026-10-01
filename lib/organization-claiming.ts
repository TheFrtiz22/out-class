/** Invitation data is a suggestion only; profile fields remain editable. */
export function invitationProfileDefaults(invitations: readonly { invitedName: string | null; invitedYear: string | null; requestedRole: string }[]) {
  const preferred = invitations.find(invitation => invitation.requestedRole === "OWNER") ?? invitations[0];
  const names = preferred?.invitedName?.trim().split(/\s+/) ?? [];
  return {
    firstName: names[0]?.slice(0, 50) ?? "",
    lastName: names.slice(1).join(" ").slice(0, 50),
    gradYear: preferred?.invitedYear && /^(202[5-9]|2030)$/.test(preferred.invitedYear) ? preferred.invitedYear : "",
  };
}
export type InvitationProfileDefaults = ReturnType<typeof invitationProfileDefaults>;
