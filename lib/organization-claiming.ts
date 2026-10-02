/** Invitation data is a suggestion only; profile fields remain editable. */
export function invitationProfileDefaults(invitations: readonly { invitedName: string | null; invitedYear: string | null; requestedRole: string }[]) {
  const ordered = [...invitations.filter(invitation => invitation.requestedRole === "OWNER"), ...invitations.filter(invitation => invitation.requestedRole !== "OWNER")];
  const names = ordered.find(invitation => invitation.invitedName?.trim())?.invitedName?.trim().split(/\s+/) ?? [];
  const year = ordered.find(invitation => invitation.invitedYear && /^(202[5-9]|2030)$/.test(invitation.invitedYear))?.invitedYear;
  return {
    firstName: names[0]?.slice(0, 50) ?? "",
    lastName: names.slice(1).join(" ").slice(0, 50),
    gradYear: year ?? "",
  };
}
export type InvitationProfileDefaults = ReturnType<typeof invitationProfileDefaults>;
