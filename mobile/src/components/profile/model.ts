import { normalizePhone, PHONE_INVALID_MESSAGE } from "@outclass/shared/phone";
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
    { label: "Experience", complete: (profile.experiences ?? []).some(item => item.title.trim()) },
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

/** The score fields as typed. Checked apart from the section because text that isn't a number parses to null, which would otherwise read as "unchanged" and vanish on Done. */
export function numberProblem(numbers: Record<string, string>): string | null {
  for (const key of Object.keys(numberLabels) as NumberKey[]) {
    const text = (numbers[key] ?? "").trim();
    if (!text) continue;
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value)) return `Enter ${numberLabels[key]} as a number.`;
    if (key === "gpa" && (value < 0 || value > 4 || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-8)) return "Enter a GPA from 0 to 4.0, with at most three decimal places.";
    if (key === "satScore" && (!Number.isInteger(value) || value < 400 || value > 1600)) return "Enter an SAT score from 400 to 1600.";
    if (key !== "gpa" && key !== "satScore" && (!Number.isInteger(value) || value < 1 || value > 36)) return `Enter an ${numberLabels[key]} score from 1 to 36.`;
  }
  return null;
}

export type NumberKey = "gpa" | "satScore" | "actScore" | "actEnglish" | "actMath" | "actReading" | "actScience";
const numberLabels: Record<NumberKey, string> = { gpa: "GPA", satScore: "SAT", actScore: "ACT composite", actEnglish: "ACT English", actMath: "ACT Math", actReading: "ACT Reading", actScience: "ACT Science" };

/**
 * The server's section rules (lib/student-profile.ts profileSectionSchemaFor) checked before a save,
 * so a mistake is named in plain words next to the form instead of the validator's own wording.
 * Null when the section can be sent; the server still decides.
 */
export function sectionProblem(draft: FullStudentProfile, section: ProfileSectionId): string | null {
  if (section === "identity") {
    if (!draft.firstName.trim()) return "Enter your first name.";
    if (!draft.lastName.trim()) return "Enter your last name.";
    if (draft.firstName.trim().length > 100 || draft.lastName.trim().length > 100) return "Names can be up to 100 characters.";
  }
  if (section === "education") {
    if (!draft.major?.trim()) return "Enter your major or intended major.";
    if ((draft.major?.trim().length ?? 0) > 200) return "Major can be up to 200 characters.";
    if (!draft.gradYear) return "Choose your graduation year.";
    if ((draft.highSchool?.trim().length ?? 0) > 200) return "High school can be up to 200 characters.";
    if (draft.scholarStatus?.selections?.includes("OTHER") && !draft.scholarStatus.other?.trim()) return "Describe Other scholar status.";
  }
  if (section === "experience") {
    const index = draft.experiences.findIndex(item => !item.title.trim() || !item.subtitle.trim());
    if (index >= 0) return `Add a role and an organization for experience ${index + 1}, or remove it.`;
    if (draft.experiences.some(item => item.title.trim().length > 200 || item.subtitle.trim().length > 200 || item.period.trim().length > 100)) return "Keep each role and organization under 200 characters, and dates under 100.";
  }
  if (section === "links") {
    const linkedin = draft.linkedinUrl?.trim();
    const host = linkedin?.replace(/^https?:\/\//i, "").split(/[/?#:]/)[0] ?? "";
    if (linkedin && (/\s/.test(linkedin) || !/(^|\.)linkedin\.com$/i.test(host))) return "Use a LinkedIn URL, like linkedin.com/in/your-name.";
  }
  if (section === "contact") {
    try { normalizePhone(draft.phone ?? ""); } catch { return PHONE_INVALID_MESSAGE; }
  }
  return null;
}
