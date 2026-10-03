import { z } from "zod";
import { storagePathSchema, safeProfileUrl, resolveResumeUrl } from "@/lib/student-profile";
import { anonymousApplication, type ReviewApplication } from "@/lib/anonymous-review";

/** One versioned contract for review, interview and persisted voting. */
export const applicantFields = ["name", "photo", "major", "graduationYear", "gpa", "sat", "act", "experiences", "answers", "applicationContext", "pros", "cons", "score", "feedback", "resume", "linkedin"] as const;
export type ApplicantField = typeof applicantFields[number];
export const fieldLabels: Record<ApplicantField, string> = {
  resume: "Résumé", linkedin: "LinkedIn", name: "Name", photo: "Photo", major: "Major", graduationYear: "Graduation year", gpa: "GPA", sat: "SAT", act: "ACT", experiences: "Experiences", answers: "Application answers", applicationContext: "Application context", pros: "Pros", cons: "Cons", score: "Evaluation score", feedback: "Overall interview / evaluation feedback",
};
const currentDisplayConfigSchema = z.object({ version: z.literal(1), fields: z.array(z.enum(applicantFields)).max(applicantFields.length).refine(v => new Set(v).size === v.length, "Choose each field once.") }).strict();
// Historical round configs may retain the retired field; no data migration is necessary.
export const displayConfigSchema = z.preprocess(value => {
  if (value && typeof value === 'object' && 'fields' in value && Array.isArray(value.fields)) return { ...value, fields: value.fields.filter(f => f !== 'biography') }
  return value
}, currentDisplayConfigSchema);
export type ApplicantDisplayConfig = z.infer<typeof displayConfigSchema>;
export const defaultDisplayConfig: ApplicantDisplayConfig = { version: 1, fields: [...applicantFields] };
export function readDisplayConfig(value: unknown): ApplicantDisplayConfig {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return defaultDisplayConfig;
  return displayConfigSchema.parse(value);
}
export type ObservationView = { id: string; kind: string; body: string; author: string; own: boolean; createdAt: string; updatedAt: string };
export type DisplaySection = { field: ApplicantField; label: string; items: string[] };
export type ApplicantDisplay = { applicationId: string; roundId: string; anonymous: boolean; configured: ApplicantField[]; visible: ApplicantField[]; withheld: ApplicantField[]; sections: DisplaySection[]; photo: string | null; observations: ObservationView[]; links: { field: "resume" | "linkedin"; label: string; href: string }[] };
const anonymousFields = new Set<ApplicantField>(["graduationYear", "gpa", "sat", "act", "applicationContext", "score"]);
/** Call only after authorizing the application. Config removes fields; it never grants access. */
export function projectApplicantDisplay(app: ReviewApplication, round: { id: string; name: string; anonymousReview: boolean }, config: ApplicantDisplayConfig, observations: ObservationView[]): ApplicantDisplay {
  const anonymous = round.anonymousReview;
  const safe = anonymous ? anonymousApplication(app) : app;
  const profile = safe.student.studentProfile;
  const visible = config.fields.filter(f => (!anonymous || anonymousFields.has(f)) && (f !== "experiences" || !config.fields.includes("resume")));
  const enabled = new Set(visible);
  const data: Record<Exclude<ApplicantField, "photo" | "resume" | "linkedin">, string[]> = {
    name: [profile ? `${profile.firstName} ${profile.lastName}` : "Profile not provided"],
    major: profile?.major ? [profile.major] : [],
    graduationYear: profile?.gradYear ? [String(profile.gradYear)] : [],
    gpa: profile?.gpa == null ? [] : [String(profile.gpa)],
    sat: profile?.satScore == null ? [] : [String(profile.satScore)],
    act: profile?.actScore == null ? [] : [String(profile.actScore)],
    experiences: profile?.experiences.map(e => [e.title, e.subtitle, e.period].filter(Boolean).join(" · ")) || [],
    // File answers and signed capabilities remain outside the presentation contract.
    answers: safe.answers.filter(a => a.question.type !== "FILE_UPLOAD").map(a => `${a.question.prompt}\n${a.response}`),
    applicationContext: [`${round.name} · ${safe.status}`],
    pros: anonymous ? [] : observations.filter(o => o.kind === "PRO").map(o => `${o.body}\n— ${o.author}`),
    cons: anonymous ? [] : observations.filter(o => o.kind === "CON").map(o => `${o.body}\n— ${o.author}`),
    score: safe.evaluations.map(e => `${e.round}: ${e.score} / 10 · Reviewer ${e.interviewerId}`),
    feedback: anonymous ? [] : safe.evaluations.filter(e => e.notes).map(e => `${e.round} · Reviewer ${e.interviewerId}\n${e.notes}`),
  };
  return {
    applicationId: app.id, roundId: round.id, anonymous, configured: config.fields, visible,
    withheld: config.fields.filter(f => !enabled.has(f)),
    sections: visible.filter((f): f is Exclude<ApplicantField, "photo" | "resume" | "linkedin"> => !["photo", "resume", "linkedin"].includes(f)).map(field => ({ field, label: fieldLabels[field], items: data[field] })),
    photo: enabled.has("photo") && safeProfileUrl(profile?.headshotUrl) ? profile!.headshotUrl : null,
    links: anonymous ? [] : [
      ...(enabled.has("resume") && profile?.resumeUrl && (storagePathSchema.safeParse(profile.resumeUrl).success || safeProfileUrl(profile.resumeUrl)) ? [{ field: "resume" as const, label: "Résumé", href: resolveResumeUrl(profile.resumeUrl)! }] : []),
      ...(enabled.has("linkedin") && /^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\//i.test(profile?.linkedinUrl || "") ? [{ field: "linkedin" as const, label: "LinkedIn", href: profile!.linkedinUrl! }] : []),
    ],
    observations: anonymous ? [] : observations.filter(o => enabled.has(o.kind === "PRO" ? "pros" : "cons")),
  };
}
