/**
 * A club's Alumni tab (actions/club-alumni.ts, components/club-alumni.tsx). Pure and browser-safe.
 * Rows are roster memberships the graduation job marked as alumni (ClubMember.alumniSince), whose
 * account is enabled and whose owner kept "Show me in my clubs' alumni list" on.
 */
export const ALUMNI_PAGE_SIZE = 20

export function alumniDirectoryWhere(clubId: string) {
  return {
    clubId, status: "ACTIVE" as const, alumniSince: { not: null },
    user: { disabledAt: null, studentProfile: { is: { alumniDirectoryVisible: true } } },
  }
}

type AlumniRow = {
  id: string
  alumniSince: Date | string | null
  user: { email: string; studentProfile: { firstName: string; lastName: string; gradYear: number; postGradEmployer: string | null; postGradRole: string | null } | null }
}
export type ClubAlumnus = { id: string; name: string; email: string; employer: string | null; role: string | null; gradYear: number | null }

/** Exactly the fields members see: name, email, employer, role and class year (never phone). */
export function presentAlumnus(row: AlumniRow): ClubAlumnus {
  const p = row.user.studentProfile
  return { id: row.id, name: p ? `${p.firstName} ${p.lastName}`.trim() : row.user.email, email: row.user.email, employer: p?.postGradEmployer ?? null, role: p?.postGradRole ?? null, gradYear: p?.gradYear ?? null }
}
