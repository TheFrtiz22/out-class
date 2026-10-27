import { submittedScoreSummary } from "@/lib/interview-review-summary";
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config";
import { dayKey, zonedInstant } from "@/lib/interview-rooms";
import { addDays } from "@/lib/availability";

/** The scheduled session's Eastern calendar day, including 23/25-hour DST days. */
export function interviewHistoryWindow(start: Date | string) {
  const day = dayKey(new Date(start).toISOString(), SCHEDULING_TIMEZONE);
  return { start: zonedInstant(day, "00:00", SCHEDULING_TIMEZONE), end: zonedInstant(addDays(day, 1), "00:00", SCHEDULING_TIMEZONE) };
}
export type HistoryApplicant = { id: string; name: string; reviews: { id: string; interviewerId: string; score: number; submittedAt: Date | string | null }[] };
/** Call only after current per-applicant score visibility and anonymity checks. */
export function previousApplicantScores(applicants: HistoryApplicant[]) {
  const grouped = new Map<string, HistoryApplicant>();
  for (const app of applicants) {
    const previous = grouped.get(app.id);
    grouped.set(app.id, previous ? { ...previous, reviews: [...previous.reviews, ...app.reviews] } : app);
  }
  return [...grouped.values()].flatMap(app => {
    const summary = submittedScoreSummary(app.reviews, []);
    const dates = app.reviews.filter(r => r.submittedAt && Number.isFinite(r.score) && r.score >= 1 && r.score <= 10).map(r => +new Date(r.submittedAt!));
    return summary.average === null || !dates.length || dates.some(date => !Number.isFinite(date)) ? [] : [{ id: app.id, name: app.name, score: summary.average, completedAt: Math.max(...dates) }];
  }).sort((a, b) => b.completedAt - a.completedAt || b.id.localeCompare(a.id)).slice(0, 5).map(({ id, name, score }) => ({ id, name, score }));
}
