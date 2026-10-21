import { compareAcademicYears } from "@/lib/recruitment-profile"

export type ApplicantSort = "name" | "round" | "year" | "gpa" | "sat" | "act" | "status" | "score"
type SortableApplicant = { id: string; roundId: string; status: string; student: { email: string; studentProfile: { firstName: string; lastName: string; academicYear?: string; gpa?: number | null; satScore?: number | null; actScore?: number | null } | null }; roundScore?: { average: number | null } | null }
export function compareApplicants(a: SortableApplicant, b: SortableApplicant, key: ApplicantSort, descending: boolean, rounds: { id: string; order: number }[] = []) {
  const name = (app: SortableApplicant) => app.student.studentProfile ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}` : app.student.email
  let left: number | string | null | undefined, right: typeof left
  if (["gpa", "sat", "act", "score"].includes(key)) {
    const value = (app: SortableApplicant) => key === "score" ? app.roundScore?.average : key === "gpa" ? app.student.studentProfile?.gpa : key === "sat" ? app.student.studentProfile?.satScore : app.student.studentProfile?.actScore
    left = value(a); right = value(b)
  } else if (key === "year") { left = a.student.studentProfile?.academicYear; right = b.student.studentProfile?.academicYear }
  else if (key === "round") { left = rounds.find(round => round.id === a.roundId)?.order; right = rounds.find(round => round.id === b.roundId)?.order }
  else if (key === "status") { left = a.status; right = b.status }
  else { left = name(a); right = name(b) }
  // Missing values remain at the bottom in both directions; hidden scores stay hidden.
  if (left == null || left === "" || right == null || right === "") return left == null || left === "" ? right == null || right === "" ? name(a).localeCompare(name(b)) : 1 : -1
  const compared = key === "year" ? compareAcademicYears(String(left), String(right)) : typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))
  return (descending ? -compared : compared) || name(a).localeCompare(name(b)) || a.id.localeCompare(b.id)
}
