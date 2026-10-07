import { supportedGpa } from "@/lib/student-profile";
import type { FullStudentProfile } from "@/lib/student-profile";

const academicYearLabels = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year", "Sixth Year", "Seventh Year", "Eighth Year"];
export function compareAcademicYears(a: string, b: string) {
  const rank = (v: string) => v === "Incoming Student" ? 0 : academicYearLabels.includes(v.replace(/\*$/, "")) ? academicYearLabels.indexOf(v.replace(/\*$/, "")) + 1 : v === "Beyond Eighth Year" ? 9 : 10;
  return rank(a) - rank(b) || a.localeCompare(b);
}

/** Academic year advances at the start of the fall academic year (August, UTC).
 * Graduation denotes spring completion: May 2027 is Fourth Year in fall 2026.
 * A graduation estimate cannot establish time enrolled, especially for transfers.
 */
export function academicYear(profile: { gradYear: number; transferStudent?: boolean }, now = new Date()) {
  const academicStart = now.getUTCFullYear() - (now.getUTCMonth() < 7 ? 1 : 0);
  const year = academicStart + 5 - profile.gradYear;

  const label = year < 1 ? "Incoming Student" : academicYearLabels[year - 1] || (year > 8 ? "Beyond Eighth Year" : "Year unavailable");
  return `${label}${profile.transferStudent ? "*" : ""}`;
}
export type RecruitmentProfile = Omit<FullStudentProfile, "gradYear" | "highSchool" | "pronouns" | "transferStudent" | "gender"> & { academicYear: string; gender: string | null };
/** Explicit allowlist: schema additions cannot silently become recruiter-visible. */
export function recruitmentProfile(p: FullStudentProfile, genderVisible = false): RecruitmentProfile {
  return {
    id: p.id, userId: p.userId, firstName: p.firstName, lastName: p.lastName, computingId: p.computingId,
    major: p.major, scholarStatus: p.scholarStatus, gpa: supportedGpa(p.gpa), satScore: p.satScore,
    actScore: p.actScore, actEnglish: p.actEnglish, actMath: p.actMath, actReading: p.actReading, actScience: p.actScience,
    bio: p.bio, linkedinUrl: p.linkedinUrl, resumeUrl: p.resumeUrl, headshotUrl: p.headshotUrl,
    experiences: p.experiences, academicYear: academicYear(p), gender: genderVisible ? p.gender : null,
  };
}
export function genderVisibility(value: unknown) {
  return !!value && typeof value === "object" && "version" in value && value.version === 1 && "fields" in value && Array.isArray(value.fields) && value.fields.includes("gender");
}
export function memberAcademicProfile<T extends { gradYear: number; transferStudent?: boolean }>(p: T) {
  const { gradYear: _year, transferStudent: _transfer, ...fields } = p;
  void _year; void _transfer;
  return { ...fields, academicYear: academicYear(p) };
}
