/**
 * The club-interest survey (web: lib/interest-survey.ts). The ids are what the server stores and
 * validates; the labels are the web's own. Answers are private to the student.
 */
export const INTEREST_CHIPS = [
  { id: "consulting", label: "Consulting" },
  { id: "finance", label: "Finance & investing" },
  { id: "business", label: "Business & startups" },
  { id: "tech", label: "Tech & engineering" },
  { id: "impact", label: "Social impact" },
  { id: "pre-professional", label: "Pre-professional" },
  { id: "greek", label: "Greek life" },
  { id: "sports", label: "Sports & recreation" },
  { id: "arts", label: "Arts & performance" },
  { id: "academic", label: "Academic & research" },
  { id: "social", label: "Social" },
] as const;
export const CLUB_GOALS = [
  { id: "career", label: "Career" },
  { id: "community", label: "Community and friends" },
  { id: "service", label: "Service" },
  { id: "creative", label: "Creative outlet" },
  { id: "competition", label: "Competition" },
  { id: "leadership", label: "Leadership" },
] as const;
export const WEEKLY_HOURS = [
  { id: "1-2", label: "1–2 hours" },
  { id: "3-5", label: "3–5 hours" },
  { id: "6+", label: "6+ hours" },
] as const;
export const SELECTIVITY = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "either", label: "Either" },
] as const;
export const MAX_INTERESTS = 6;

export type InterestId = (typeof INTEREST_CHIPS)[number]["id"];
export type GoalId = (typeof CLUB_GOALS)[number]["id"];
export type WeeklyHours = (typeof WEEKLY_HOURS)[number]["id"];
export type Selectivity = (typeof SELECTIVITY)[number]["id"];
export type InterestAnswers = { interests: InterestId[]; goals: GoalId[]; weeklyHours: WeeklyHours | null; selectivity: Selectivity | null };
/** `interests` (actions/interest-survey.ts getMyInterestSurvey): null in a support session, which the app never is. */
export type InterestSurvey = InterestAnswers & { revision: number; completed: boolean; dismissed: boolean };

const known = <T extends string>(values: readonly { id: T }[]) => (value: unknown): value is T => values.some(option => option.id === value);
const isInterest = known(INTEREST_CHIPS), isGoal = known(CLUB_GOALS), isHours = known(WEEKLY_HOURS), isSelectivity = known(SELECTIVITY);

/**
 * The answers as the form edits them. An id the app does not know (a newer web option) is dropped
 * here rather than sent back, since the server would refuse the whole save for it.
 */
export function answersOf(survey: Partial<InterestSurvey> | null | undefined): InterestAnswers {
  const unique = <T,>(values: T[]) => [...new Set(values)];
  return {
    interests: unique((Array.isArray(survey?.interests) ? survey.interests : []).filter(isInterest)).slice(0, MAX_INTERESTS),
    goals: unique((Array.isArray(survey?.goals) ? survey.goals : []).filter(isGoal)),
    weeklyHours: isHours(survey?.weeklyHours) ? survey.weeklyHours : null,
    selectivity: isSelectivity(survey?.selectivity) ? survey.selectivity : null,
  };
}
export const sameAnswers = (a: InterestAnswers, b: InterestAnswers) => JSON.stringify(a) === JSON.stringify(b);
