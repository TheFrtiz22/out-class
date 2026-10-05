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
    { label: "Discover", title: "Find the organizations that fit you.", description: "Follow your interests. Find a place for them to grow.", scene: "discover" },
    { label: "Profile", title: "Start with your story.", description: "Your academics, experience, and resume. One introduction that comes with you.", scene: "profile" },
    { label: "Apply", title: "Less repetition. More you.", description: "Bring your shared profile. Focus on the questions that make each club different.", scene: "apply" },
    { label: "Interview", title: "Make room for a conversation.", description: "Your invitation, your time, and your next step. All together.", scene: "student-interview" },
    { label: "Status", title: "Know your next step.", description: "From submitted to decided. See where every application stands.", scene: "status" },
    { label: "Join", title: "You found your people.", description: "From applicant to member. Your next chapter lives in My Clubs.", scene: "join" },
  ],
  leader: [
    { label: "Build", title: "A clearer way to recruit.", description: "Set your questions, shape your rounds, and build a process that fits your club.", scene: "build" },
    { label: "Review", title: "See the person behind the application.", description: "Profiles, responses, shared rubrics, and notes. Give every applicant a thoughtful read.", scene: "review" },
    { label: "Schedule", title: "Get everyone in the room.", description: "Availability, applicant booking, panels, and rooms. One coordinated schedule.", scene: "schedule" },
    { label: "Interview", title: "Interview together.", description: "Applicant context, shared questions, and collaborative notes. Keep your team on the same page.", scene: "leader-interview" },
    { label: "Decide", title: "Build your next class.", description: "Bring votes and feedback together. Advance applicants and record decisions with clarity.", scene: "decide" },
    { label: "Manage", title: "Then keep your club moving.", description: "Welcome your members. Keep meetings, tasks, and conversations connected.", scene: "manage" },
  ],
} as const

export type JourneyScene = (typeof journeyChapters)[LandingPerspective][number]["scene"]

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
