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
    { stage: "discover", label: "Discover", title: "Find your kind of curious.", description: "Explore participating organizations by interest. Get to know a club before you decide to apply.", detail: "Start with the possibilities.", scene: "discover" },
    { stage: "apply", label: "Apply", title: "One profile. Your own answers.", description: "Your academics, experience, and resume come with you. Spend your time on the questions that make each club different.", detail: "A shared introduction. A specific application.", scene: "apply" },
    { stage: "interview", label: "Interview", title: "An invitation, with a plan.", description: "When a club invites you, choose from its available interview times. Keep your booking and next step together.", detail: "Make room for the conversation.", scene: "student-interview" },
    { stage: "track", label: "Track", title: "Know where you stand.", description: "Follow each submitted application from review to decision. See the current status without piecing together separate updates.", detail: "Every application. One place to look.", scene: "status" },
    { stage: "belong", label: "Belong", title: "From applicant to part of the team.", description: "Find your joined organizations in My Clubs. Keep up with meetings and the work that comes next.", detail: "The application is only the beginning.", scene: "join" },
  ],
  leader: [
    { stage: "setup", label: "Set Up", title: "A process that fits your club.", description: "Start with your approved club workspace. Update your profile, prepare your questions, and shape a recruitment process that feels like you.", detail: "Claim requests are reviewed before access is granted.", scene: "build" },
    { stage: "recruit", label: "Recruit", title: "Your recruitment. All together.", description: "Set your questions and rounds, then follow incoming applications in one organized pipeline. Keep the next step clear for your whole team.", detail: "From a ready application to an active applicant pool.", scene: "recruit" },
    { stage: "review", label: "Review", title: "See the person behind the application.", description: "Read profiles and club-specific responses together. Save evaluations with shared rubrics, or use anonymous review when configured for a round.", detail: "A thoughtful read. A shared point of reference.", scene: "review" },
    { stage: "interview", label: "Interview", title: "A schedule your team can trust.", description: "Bring availability and interview rooms together. Auto-fill a panel proposal, review the assignments, and approve the schedule before it goes live.", detail: "Suggested by OutClass. Reviewed and published by an owner.", scene: "leader-interview" },
    { stage: "decide", label: "Decide", title: "Bring the decision into focus.", description: "Bring evaluations into the final conversation. Record acceptances, waitlists, or declines. An accepted decision gives the student an offer to respond to.", detail: "Your team’s judgment. A clear next step for every applicant.", scene: "decide" },
    { stage: "manage", label: "Manage", title: "Build your next class. Then keep going.", description: "Once students accept their offers, welcome them into your roster. Manage member access, announcements, meetings, and tasks in the same workspace.", detail: "Recruitment ends. Your club keeps going.", scene: "manage" },
  ],
} as const

export type JourneyScene = (typeof journeyChapters)[LandingPerspective][number]["scene"] | "profile" | "schedule"

// One deliberate interaction per preview, followed by a useful final state.
// Timings are identical across devices; mobile no longer rushes through the story.
export const journeySceneDurations: Record<JourneyScene, number> = {
  discover: 2700,
  profile: 3000,
  apply: 3500,
  "student-interview": 3100,
  status: 3200,
  join: 3000,
  build: 3300,
  recruit: 4200,
  review: 3200,
  schedule: 3300,
  "leader-interview": 6600,
  decide: 3500,
  manage: 3100,
}

// Both perspectives use the same applicant, organization, and interview.
export const journeyExample = {
  person: "Jordan Avery",
  initials: "JA",
  headshot: "/images/landing/jordan-avery.jpg",
  club: "Jefferson Investment Society",
  clubMark: "JIS",
  clubLogo: "/images/landing/jefferson-investment-society.png",
  consultingClub: "Grounds Impact Consulting",
  consultingClubMark: "GIC",
  consultingClubLogo: "/images/landing/grounds-impact-consulting.png",
  interview: "Thursday · 6:30 PM",
  panel: "Panel A",
  room: "Room 204",
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
