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
    { stage: "discover", label: "Set Up", title: "A process that fits your club.", description: "Configure your application questions and recruitment rounds. Give students a clear place to start.", detail: "Your questions. Your recruitment.", scene: "build" },
    { stage: "apply", label: "Review", title: "See the person behind the application.", description: "Read profiles and club-specific responses together. Use shared rubrics and notes to coordinate your team’s review.", detail: "Context for a more thoughtful read.", scene: "review" },
    { stage: "interview", label: "Interview", title: "Get your team on the same page.", description: "Coordinate availability, bookings, and panels. Bring applicant context, shared questions, and collaborative notes into the interview.", detail: "A coordinated schedule. A shared conversation.", scene: "leader-interview" },
    { stage: "track", label: "Decide", title: "Bring the decision into focus.", description: "Gather votes and feedback, advance applicants, and record decisions. Your club stays in control of its process.", detail: "Clarity from first review to final decision.", scene: "decide" },
    { stage: "belong", label: "Belong", title: "Build your next class. Then keep going.", description: "Welcome accepted applicants into your club. Keep members, meetings, and tasks connected as the semester moves on.", detail: "More than recruitment day.", scene: "manage" },
  ],
} as const

export type JourneyScene = (typeof journeyChapters)[LandingPerspective][number]["scene"] | "profile" | "schedule"

// Finite visible-time demos; compact screens run the same story 20% faster.
export const journeySceneDurations: Record<JourneyScene, number> = {
  discover: 3600,
  profile: 4000,
  apply: 4800,
  "student-interview": 4000,
  status: 4800,
  join: 4200,
  build: 4200,
  review: 4300,
  schedule: 4600,
  "leader-interview": 4800,
  decide: 4800,
  manage: 4000,
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
