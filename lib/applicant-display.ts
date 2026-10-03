import { z } from "zod";
import { anonymousApplication, type ReviewApplication } from "@/lib/anonymous-review";

/** One versioned contract for review, interview and the future voting service. */
export const applicantFields = ["name", "photo", "major", "graduationYear", "gpa", "sat", "act", "experiences", "biography", "answers", "applicationContext", "pros", "cons", "score", "feedback"] as const;
export type ApplicantField = typeof applicantFields[number];
export const fieldLabels: Record<ApplicantField, string> = {
  name: "Name", photo: "Photo", major: "Major", graduationYear: "Graduation year", gpa: "GPA", sat: "SAT", act: "ACT and sections", experiences: "Experiences", biography: "Profile introduction", answers: "Application answers", applicationContext: "Application context", pros: "Pros", cons: "Cons", score: "Evaluation score", feedback: "Overall interview / evaluation feedback",
};
export const displayConfigSchema = z.object({ version: z.literal(1), fields: z.array(z.enum(applicantFields)).max(applicantFields.length).refine(v => new Set(v).size === v.length, "Choose each field once.") }).strict();
export type ApplicantDisplayConfig = z.infer<typeof displayConfigSchema>;
export const defaultDisplayConfig: ApplicantDisplayConfig = { version: 1, fields: [...applicantFields] };
export function readDisplayConfig(value: unknown): ApplicantDisplayConfig {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return defaultDisplayConfig;
  return displayConfigSchema.parse(value);
}
export type ObservationView = { id: string; kind: string; body: string; author: string; own: boolean; createdAt: string; updatedAt: string };
export type DisplaySection = { field: ApplicantField; label: string; items: string[] };
export type ApplicantDisplay = { applicationId: string; roundId: string; anonymous: boolean; configured: ApplicantField[]; visible: ApplicantField[]; withheld: ApplicantField[]; sections: DisplaySection[]; photo: string | null; observations: ObservationView[] };
const anonymousFields = new Set<ApplicantField>(["graduationYear", "gpa", "sat", "act", "applicationContext", "score"]);
/** Call only after authorizing the application. Config removes fields; it never grants access. */
export function projectApplicantDisplay(app: ReviewApplication, round: { id: string; name: string; anonymousReview: boolean }, config: ApplicantDisplayConfig, observations: ObservationView[]): ApplicantDisplay {
  const anonymous = round.anonymousReview;
  const safe = anonymous ? anonymousApplication(app) : app;
  const profile = safe.student.studentProfile;
  const visible = config.fields.filter(f => !anonymous || anonymousFields.has(f));
  const enabled = new Set(visible);
  const data: Record<Exclude<ApplicantField, "photo">, string[]> = {
    name: [profile ? `${profile.firstName} ${profile.lastName}` : "Profile not provided"],
    major: profile?.major ? [profile.major] : [],
    graduationYear: profile?.gradYear ? [String(profile.gradYear)] : [],
    gpa: profile?.gpa == null ? [] : [String(profile.gpa)],
    sat: profile?.satScore == null ? [] : [String(profile.satScore)],
    act: profile ? ([['Composite', profile.actScore], ['English', profile.actEnglish], ['Math', profile.actMath], ['Reading', profile.actReading], ['Science', profile.actScience]] as const).filter(([,v]) => v != null).map(([k,v]) => `${k}: ${v}`) : [],
    experiences: profile?.experiences.map(e => [e.title, e.subtitle, e.period].filter(Boolean).join(" · ")) || [],
    biography: profile?.bio ? [profile.bio] : [],
    // File paths and signed capabilities are deliberately outside the presentation contract.
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
    sections: visible.filter((f): f is Exclude<ApplicantField, "photo"> => f !== "photo").map(field => ({ field, label: fieldLabels[field], items: data[field] })),
    photo: enabled.has("photo") && /^https:\/\//i.test(profile?.headshotUrl || "") ? profile!.headshotUrl : null,
    observations: anonymous ? [] : observations.filter(o => enabled.has(o.kind === "PRO" ? "pros" : "cons")),
  };
}
