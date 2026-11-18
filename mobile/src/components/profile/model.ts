import { easternDateKey } from "~/lib/eastern";
import type { FullStudentProfile, ProfileSectionId } from "~/lib/types";

/**
 * The web's profile presentation and edit contract (lib/student-profile.ts,
 * components/edit-student-profile-dialog.tsx). Validation is the server's
 * (`profile.updateSection`); this file only builds what the web's editor sends and shows.
 */
export const sectionTitles: Record<ProfileSectionId, string> = { identity: "Name & photo", education: "Education", experience: "Experience", links: "Links & résumé", contact: "Phone" };
export const sectionOrder: ProfileSectionId[] = ["identity", "education", "experience", "links", "contact"];
export const genderValues = ["Male", "Female", "Other", "Prefer not to say"] as const;
export const pronounValues = ["He/Him", "She/Her", "They/Them", "Other"] as const;
export const scholarPrograms = ["ECHOLS", "JEFFERSON", "WALENTAS", "COLLEGE_SCIENCE", "RODMAN", "MILLER_ARTS", "CORE"] as const;
export const scholarLabels: Record<string, string> = { JEFFERSON: "Jefferson Scholars Program", WALENTAS: "Walentas Scholar", ECHOLS: "Echols Scholars Program", RODMAN: "Rodman Scholars Program", COLLEGE_SCIENCE: "College Science Scholars Program", MILLER_ARTS: "Miller Arts Scholars Program", CORE: "CORE Scholars Program", NOT_APPLICABLE: "Not Applicable", OTHER: "Other" };

const STORAGE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/\\%?#]+$/i;
/** A stored reference to an uploaded file (uuid/filename), as opposed to a web address. */
export const isStoragePath = (value?: string | null) => !!value && !value.includes("..") && STORAGE_PATH.test(value);
export const safeProfileUrl = (value?: string | null) => (value && /^https?:\/\//i.test(value) ? value : undefined);
/** The site path that serves a résumé: an outside URL as is, an uploaded PDF through /api/resumes. */
export function resumeHref(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return `/api/resumes?path=${encodeURIComponent(value)}`;
}

export function profileChecklist(profile: FullStudentProfile) {
  return [
    { label: "Name", complete: Boolean(profile.firstName.trim() && profile.lastName.trim()) },
    { label: "Education", complete: Boolean(profile.major?.trim() && profile.gradYear) },
    { label: "Résumé", complete: Boolean(resumeHref(profile.resumeUrl)) },
    { label: "LinkedIn", complete: Boolean(safeProfileUrl(profile.linkedinUrl)) },
  ];
}

export function scholarSummary(value: FullStudentProfile["scholarStatus"]): string | null {
  const selections = value && Array.isArray(value.selections) ? value.selections : null;
  if (!selections?.length) return null;
  const named = selections.filter(item => item !== "NOT_APPLICABLE").map(item => (item === "OTHER" ? value!.other : scholarLabels[item] ?? item));
  return named.length ? named.join(", ") : "Not a scholar";
}
export function toggleScholar(value: FullStudentProfile["scholarStatus"], selection: string, checked: boolean): FullStudentProfile["scholarStatus"] {
  const current = value && Array.isArray(value.selections) ? value : { selections: [] as string[], other: "" };
  const selections = checked ? (selection === "NOT_APPLICABLE" ? [selection] : [...current.selections.filter(item => item !== "NOT_APPLICABLE" && item !== selection), selection]) : current.selections.filter(item => item !== selection);
  return selections.length ? { selections, other: selections.includes("OTHER") ? current.other || "" : "" } : null;
}

/** Year options for the picker: last year through six years ahead (Eastern), plus the year on file. The server decides what it accepts. */
export function graduationYearOptions(stored?: number | null): number[] {
  const year = Number(easternDateKey().slice(0, 4));
  const years = Array.from({ length: 8 }, (_, index) => year - 1 + index);
  if (typeof stored === "number" && Number.isInteger(stored) && !years.includes(stored)) years.push(stored);
  return years.sort((a, b) => a - b);
}

/**
 * The `expected` value for `profile.updateSection`: the section as this device last loaded it.
 * The server compares it with what is stored now and refuses a save over someone else's change
 * (lib/student-profile.ts `profileSectionSnapshot`; the key order and shape must match exactly).
 */
export function sectionSnapshot(profile: FullStudentProfile, section: ProfileSectionId): string {
  const source = profile as unknown as Record<string, unknown>;
  if (section === "experience") return JSON.stringify((profile.experiences ?? []).map(({ title, subtitle, period }) => ({ title, subtitle, period })));
  const keys = section === "identity" ? ["firstName", "lastName", "headshotUrl"] : section === "links" ? ["linkedinUrl", "resumeUrl"] : section === "contact" ? ["phone"]
    : ["highSchool", "gender", "pronouns", "transferStudent", "major", "gradYear", "scholarStatus", "gpa", "satScore", "actScore", "actEnglish", "actMath", "actReading", "actScience"];
  return JSON.stringify(keys.map(key => [key, source[key] ?? null]));
}

/** What the web's editor sends for a section (unchanged photo and GPA are left out, as there). */
export function sectionPayload(draft: FullStudentProfile, original: FullStudentProfile, section: ProfileSectionId): Record<string, unknown> {
  if (section === "identity") return { section, firstName: draft.firstName, lastName: draft.lastName, ...(draft.headshotUrl !== original.headshotUrl ? { headshotUrl: draft.headshotUrl } : {}) };
  if (section === "education") return {
    section, highSchool: draft.highSchool, gender: draft.gender, pronouns: draft.pronouns, transferStudent: draft.transferStudent, major: draft.major, gradYear: draft.gradYear,
    scholarStatus: draft.scholarStatus ?? null, ...(draft.gpa !== original.gpa ? { gpa: draft.gpa } : {}), satScore: draft.satScore,
    actScore: draft.actScore, actEnglish: draft.actEnglish, actMath: draft.actMath, actReading: draft.actReading, actScience: draft.actScience,
  };
  if (section === "experience") return { section, experiences: draft.experiences.map(({ title, subtitle, period }) => ({ title, subtitle, period })) };
  if (section === "contact") return { section, phone: draft.phone ?? "" };
  return { section, linkedinUrl: draft.linkedinUrl, resumeUrl: draft.resumeUrl };
}

export const initials = (profile: { firstName?: string | null; lastName?: string | null }) => `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "OC";
