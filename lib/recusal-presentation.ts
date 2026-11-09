export function profileName(profile: { firstName: string; lastName: string } | null | undefined) {
  return profile ? `${profile.firstName} ${profile.lastName}`.trim() || "Member" : "Member"
}
