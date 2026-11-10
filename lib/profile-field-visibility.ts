import { z } from "zod";

/**
 * Single source of truth for which applicant profile fields a club's leaders see.
 * Stored per club in `Club.profileFieldVisibility` (nullable JSON; NULL means defaults).
 * Unknown keys are dropped and missing or malformed keys fall back to the defaults,
 * so adding a field later never exposes it to clubs that saved an older map.
 */
export const profileFieldKeys = ["name", "photo", "email", "major", "academicYear", "gpa", "sat", "act", "experiences", "resume", "linkedin"] as const;
export type ProfileFieldKey = typeof profileFieldKeys[number];
export type ProfileFieldVisibility = Record<ProfileFieldKey, boolean>;

export const profileFieldLabels: Record<ProfileFieldKey, string> = {
  name: "Name", photo: "Photo", email: "Email", major: "Major", academicYear: "Class year",
  gpa: "GPA", sat: "SAT", act: "ACT", experiences: "Experience", resume: "Résumé", linkedin: "LinkedIn",
};

/** Off unless a club turns them on. Every other field defaults to on, matching earlier behaviour. */
export const profileFieldsHiddenByDefault: readonly ProfileFieldKey[] = ["gpa", "linkedin"];

export function defaultProfileFieldVisibility(): ProfileFieldVisibility {
  return Object.fromEntries(profileFieldKeys.map(key => [key, !profileFieldsHiddenByDefault.includes(key)])) as ProfileFieldVisibility;
}

export function normalizeProfileFieldVisibility(value: unknown): ProfileFieldVisibility {
  const result = defaultProfileFieldVisibility();
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of profileFieldKeys) {
    const stored = (value as Record<string, unknown>)[key];
    if (typeof stored === "boolean") result[key] = stored;
  }
  return result;
}

export const profileFieldVisibilitySchema = z.object(
  Object.fromEntries(profileFieldKeys.map(key => [key, z.boolean()])) as Record<ProfileFieldKey, z.ZodBoolean>,
).strict();

export const saveProfileFieldVisibilityInput = z.object({
  clubId: z.string().uuid(),
  fields: profileFieldVisibilitySchema,
  // The map the editor last loaded: a concurrent change by another leader is a conflict.
  expected: profileFieldVisibilitySchema,
}).strict();

export function sameProfileFieldVisibility(a: ProfileFieldVisibility, b: ProfileFieldVisibility) {
  return profileFieldKeys.every(key => a[key] === b[key]);
}

/**
 * Server-side removal of hidden recruitment-profile values before a payload leaves the
 * server. Name and email are identity used for search, lists and decisions; they are
 * hidden in the profile view only. Only keys already present on the object are cleared.
 */
export function restrictProfileFields<P extends object>(profile: P, visibility: ProfileFieldVisibility): P {
  const out = { ...profile } as Record<string, unknown>;
  const clear = (keys: string[], empty: unknown) => { for (const key of keys) if (key in out) out[key] = empty; };
  if (!visibility.photo) clear(["headshotUrl"], null);
  if (!visibility.major) clear(["major"], "");
  if (!visibility.academicYear) clear(["academicYear"], "");
  if (!visibility.gpa) clear(["gpa"], null);
  if (!visibility.sat) clear(["satScore"], null);
  if (!visibility.act) clear(["actScore", "actEnglish", "actMath", "actReading", "actScience"], null);
  if (!visibility.experiences) clear(["experiences"], []);
  if (!visibility.resume) clear(["resumeUrl"], null);
  if (!visibility.linkedin) clear(["linkedinUrl"], null);
  return out as P;
}

/** Applies the club ceiling to an application-shaped payload's student profile. */
export function restrictApplicationProfile<A extends { student: { studentProfile: object | null } }>(app: A, visibility: ProfileFieldVisibility): A {
  const profile = app.student.studentProfile;
  return profile ? { ...app, student: { ...app.student, studentProfile: restrictProfileFields(profile, visibility) } } : app;
}

/** Applicant Display and voting-slide fields that the club setting caps. Other fields are unaffected. */
const cappedDisplayFields = new Set<string>(["name", "photo", "major", "academicYear", "gpa", "sat", "act", "experiences", "resume", "linkedin"]);
export function allowedByProfileCeiling(field: string, visibility: ProfileFieldVisibility) {
  return !cappedDisplayFields.has(field) || visibility[field as ProfileFieldKey] !== false;
}
