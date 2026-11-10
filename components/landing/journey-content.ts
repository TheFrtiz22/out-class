export type LandingPerspective = "student" | "leader"

export function perspectiveFromHash(hash: string): LandingPerspective | null {
  if (hash === "#students") return "student"
  if (hash === "#club-leaders" || hash === "#clubs") return "leader"
  return null
}

export const perspectiveHash = (perspective: LandingPerspective) =>
  perspective === "student" ? "#students" : "#club-leaders"

export const journeyChapters = {
  student: [
    { stage: "discover", label: "Discover", title: "Find your kind of curious.", description: "Explore participating organizations by interest. Get to know a club before you decide to apply.", detail: "Start with the possibilities." },
    { stage: "apply", label: "Apply", title: "One profile. Your own answers.", description: "Your academics, experience, and resume come with you. Spend your time on the questions that make each club different.", detail: "A shared introduction. A specific application." },
    { stage: "interview", label: "Interview", title: "An invitation, with a plan.", description: "When a club invites you, choose from its available interview times. Keep your interview and next step together.", detail: "Make room for the conversation." },
    { stage: "track", label: "Track", title: "Know where you stand.", description: "Follow each submitted application from review to decision. See the current status without piecing together separate updates.", detail: "Every application. One place to look." },
    { stage: "belong", label: "Belong", title: "From applicant to part of the team.", description: "Find your joined organizations in My Clubs. Keep up with meetings and the work that comes next.", detail: "The application is only the beginning." },
  ],
  leader: [
    { stage: "setup", label: "Set Up", title: "A process that fits your club.", description: "Start with your approved club workspace. Update your profile, prepare your questions, and shape a recruitment process that feels like you.", detail: "Claim requests are reviewed before access is granted." },
    { stage: "recruit", label: "Recruit", title: "Your recruitment. All together.", description: "Set your questions and rounds, then follow incoming applications in one organized pipeline. Keep the next step clear for your whole team.", detail: "From a ready application to an active applicant pool." },
    { stage: "review", label: "Review", title: "See the person behind the application.", description: "Read profiles and club-specific responses together. Save evaluations with shared rubrics, or use anonymous review when a round turns it on.", detail: "A thoughtful read. A shared point of reference." },
    { stage: "interview", label: "Interview", title: "A schedule your team can trust.", description: "Bring availability and interview rooms together. Auto-fill a panel proposal, review the assignments, and approve the schedule before it goes live.", detail: "Suggested by OutClass. Reviewed and published by an owner." },
    { stage: "decide", label: "Decide", title: "Bring the decision into focus.", description: "Bring evaluations into the final conversation. Record acceptances, waitlists, or declines. An accepted decision gives the student an offer to respond to.", detail: "Your team’s judgment. A clear next step for every applicant." },
    { stage: "manage", label: "Manage", title: "Build your next class. Then keep going.", description: "Once students accept their offers, welcome them into your roster. Manage member access, announcements, meetings, and tasks in the same workspace.", detail: "Recruitment ends. Your club keeps going." },
  ],
} as const

export type JourneyStage = (typeof journeyChapters)[LandingPerspective][number]["stage"]

/** Preserve the task being read, rather than an index in differently sized stories. */
export function equivalentJourneyStage(stage: JourneyStage, audience: LandingPerspective): JourneyStage {
  if (journeyChapters[audience].some(chapter => chapter.stage === stage)) return stage
  const equivalents: Partial<Record<JourneyStage, JourneyStage>> = audience === "leader"
    ? { discover: "setup", apply: "recruit", track: "decide", belong: "manage" }
    : { setup: "discover", recruit: "apply", review: "apply", decide: "track", manage: "belong" }
  return equivalents[stage] ?? "interview"
}

export function journeyChapterHref(audience: LandingPerspective, index: number, search = "") {
  const params = new URLSearchParams(search)
  params.set("audience", audience)
  return `?${params}#journey-${index + 1}`
}

type SampleTone = "done" | "active" | "neutral" | "navy"
export type JourneySample = { card: string; sub: string; rows: readonly { name: string; meta: string; chip: string; tone: SampleTone }[] }

/** Fictional sample screens for the "How OutClass works" tabs; never connected to product data. */
export const journeySamples: { [A in LandingPerspective]: Record<(typeof journeyChapters)[A][number]["stage"], JourneySample> } = {
  student: {
    discover: { card: "Explore clubs", sub: "Recruiting this spring", rows: [
      { name: "Jefferson Investment Society", meta: "Finance · applications open", chip: "Recruiting", tone: "active" },
      { name: "Grounds Impact Consulting", meta: "Consulting · applications open", chip: "Recruiting", tone: "active" },
      { name: "Following", meta: "Get updates when a club opens", chip: "2 clubs", tone: "neutral" } ] },
    apply: { card: "Application · Jefferson Investment Society", sub: "Due Friday 11:59 PM", rows: [
      { name: "Profile", meta: "Academics and experience", chip: "Included", tone: "done" },
      { name: "Resume", meta: "Updated Oct 20", chip: "Included", tone: "done" },
      { name: "Club questions", meta: "2 of 3 answered", chip: "In progress", tone: "active" } ] },
    interview: { card: "Choose an interview time", sub: "Jefferson Investment Society", rows: [
      { name: "Thursday 6:30 PM", meta: "Room 204 · 30 minutes", chip: "Selected", tone: "navy" },
      { name: "Thursday 7:00 PM", meta: "Room 206 · 30 minutes", chip: "Open", tone: "neutral" },
      { name: "Friday 4:00 PM", meta: "Room 204 · 30 minutes", chip: "Open", tone: "neutral" } ] },
    track: { card: "My applications", sub: "Spring 2027", rows: [
      { name: "Jefferson Investment Society", meta: "Interview Thursday 6:30 PM", chip: "Interview", tone: "active" },
      { name: "Grounds Impact Consulting", meta: "Round 1 review", chip: "In review", tone: "neutral" } ] },
    belong: { card: "My clubs", sub: "Jefferson Investment Society", rows: [
      { name: "Offer accepted", meta: "Welcome to the analyst class", chip: "Member", tone: "done" },
      { name: "New member meeting", meta: "Monday 7:00 PM", chip: "Upcoming", tone: "active" },
      { name: "Onboarding tasks", meta: "2 of 4 done", chip: "In progress", tone: "neutral" } ] },
  },
  leader: {
    setup: { card: "Recruitment setup", sub: "Spring 2027 · Analyst class", rows: [
      { name: "Club profile", meta: "Description, photos and links", chip: "Published", tone: "done" },
      { name: "Application questions", meta: "Four club-specific questions", chip: "Ready", tone: "done" },
      { name: "Round 1 · Written review", meta: "Shared rubric, anonymous review on", chip: "Ready", tone: "done" },
      { name: "Round 2 · Interviews", meta: "Panels of two, 30 minutes", chip: "Draft", tone: "active" } ] },
    recruit: { card: "Applications", sub: "Round 1 · 24 submitted", rows: [
      { name: "Jordan Avery", meta: "Third year · Commerce", chip: "Submitted", tone: "done" },
      { name: "Priya Nair", meta: "Second year · Economics", chip: "Submitted", tone: "done" },
      { name: "Marcus Lee", meta: "First year · Undeclared", chip: "Submitted", tone: "done" },
      { name: "Sofia Chen", meta: "Second year · Computer Science", chip: "Draft", tone: "neutral" } ] },
    review: { card: "Evaluation · Applicant 07", sub: "Anonymous review · Round 1", rows: [
      { name: "Fit with the club", meta: "4 of 5", chip: "Scored", tone: "done" },
      { name: "Written response", meta: "5 of 5", chip: "Scored", tone: "done" },
      { name: "Experience", meta: "4 of 5", chip: "Scored", tone: "done" },
      { name: "Overall note", meta: "Visible to reviewers in this round", chip: "Saving", tone: "active" } ] },
    interview: { card: "Panel proposal", sub: "Thursday · 6 interviews", rows: [
      { name: "Panel A · Room 204", meta: "6:30 PM · two interviewers", chip: "Approved", tone: "done" },
      { name: "Panel B · Room 206", meta: "7:00 PM · two interviewers", chip: "Approved", tone: "done" },
      { name: "Panel C · Room 204", meta: "7:30 PM · one interviewer", chip: "Needs one more", tone: "active" },
      { name: "Publish schedule", meta: "Owner approval required", chip: "Waiting", tone: "neutral" } ] },
    decide: { card: "Decisions", sub: "Final round · 6 applicants", rows: [
      { name: "Daniel Okafor", meta: "Panel average 8.5", chip: "Offer", tone: "navy" },
      { name: "Jordan Avery", meta: "Panel average 8.0", chip: "Offer", tone: "navy" },
      { name: "Priya Nair", meta: "Panel average 7.0", chip: "Waitlist", tone: "active" },
      { name: "Marcus Lee", meta: "Panel average 6.0", chip: "Undecided", tone: "neutral" } ] },
    manage: { card: "Club home", sub: "38 members", rows: [
      { name: "New member meeting", meta: "Monday 7:00 PM · QR check-in", chip: "Upcoming", tone: "active" },
      { name: "Onboarding tasks", meta: "12 of 18 members done", chip: "In progress", tone: "neutral" },
      { name: "Welcome announcement", meta: "Sent to the new class", chip: "Sent", tone: "done" },
      { name: "Roles and access", meta: "Owners, admins, interviewers, members", chip: "Up to date", tone: "done" } ] },
  },
}

export const journeySample = (audience: LandingPerspective, stage: JourneyStage): JourneySample | undefined =>
  (journeySamples[audience] as Partial<Record<JourneyStage, JourneySample>>)[stage]
