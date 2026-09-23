import { isDemoMode } from "@/lib/demo-utils"
import * as demo from "@/lib/demo-data"

export type Stage = "Draft" | "Applied" | "Round 1" | "Round 2" | "Decision"

export const STAGES: Stage[] = ["Applied", "Round 1", "Round 2", "Decision"]

/* ── Demo data injection ──
 * When demo mode is enabled via localStorage, the empty arrays below are
 * replaced with factory-generated demo data. The demo-data modules import
 * only *types* from this file (not values), so there is no circular
 * runtime dependency.
 *
 * isDemoMode() returns false during SSR (no localStorage).
 * The page reloads on toggle, so module caching is cleanly reset.
 */
const _demo = isDemoMode()

export type Club = {
  id: string
  name: string
  tagline: string
  logoUrl?: string | null
  logoText: string
  color: string
  acceptanceRate: string
  aum: string
  members: number
  description: string
  exec: { name: string; role: string; initials: string }[]
}

export const clubs: Club[] = _demo ? demo.demoClubs : []
export const featuredClub = _demo ? demo.demoClubs[0] : undefined
export type Application = {
  id: string
  clubId: string
  clubName: string
  logoUrl?: string | null
  logoText: string
  color: string
  stage: Stage
  outcome?: "Accepted" | "Rejected"
  nextStep: string
  submitted: string
  deadline?: string
  essaysWritten?: number
  essaysTotal?: number
}
export const applications: Application[]  = []

export const currentStudent = {
  name: "Jordan Avery",
  major: "Economics & Computer Science",
  year: "Junior",
  classYear: "Class of 2028",
  computingId: "jda4bg",
  email: "jda4bg@virginia.edu",
  linkedin: "linkedin.com/in/jordanavery",
  bio: "Junior focused on markets and product. Prior internship in equity research; building a personal options-analytics project. Looking to contribute to a rigorous, collaborative team.",
  gpa: "3.87",
  initials: "JA",
  location: "Boston, MA",
  resumeFileName: "Jordan_Avery_Resume.pdf",
}

export type StudentMembership = {
  clubId: string
  clubName: string
  logoUrl?: string | null
  logoText: string
  color: string
  role: "Member" | "Executive"
  title?: string
}

/** Clubs the current student belongs to, shown on their Unified Profile. */
export const studentMemberships: StudentMembership[]  = []

export type ExperienceItem = {
  id: string
  title: string
  subtitle: string
  period: string
}

export const experienceItems: ExperienceItem[]  = []

export type EventType = "Deadline" | "Interest Meeting" | "Coffee Chat" | "Interview" | "Other"

export type ClubEvent = {
  /** Persisted booking/attendance: changes require a server action. */
  readOnly?: boolean
  date: string
  clubId?: string
  location?: string
  description?: string
  durationMinutes?: number
  meetingUrl?: string
  managedEventId?: string
  bookingSlotId?: string
  response?: "going" | "confirmed" | "declined"

  id: string
  day: number
  title: string
  club: string
  color: string
  type: EventType
  time: string
}

// Events for the current month grid (day = date in month)
export const events: ClubEvent[]  = []

export type CoffeeChatRequest = {
  id: string
  leaderName: string
  leaderInitials: string
  clubName: string
  color: string
  status: "Pending" | "Confirmed"
  proposedSlots: string[]
}

export const coffeeChatRequests: CoffeeChatRequest[]  = []

export type Applicant = {
  id: string
  headshotUrl?: string
  resumeHighlight?: string
  interviewScores?: { round: string; score: number; maxScore: number }[]
  name: string
  email: string
  initials: string
  major: string
  year: string
  status: string
  score: number
  gpa: string
  satScore: number
  resumeFileName: string
  links: { label: string; url: string }[]
  essays: { question: string; answer: string }[]
}

export const applicants: Applicant[]  = []

export type ScreeningStatus = "Passed Auto-Filter" | "Auto-Flagged" | "Manually Approved" | "Rejected"

export type ScreeningApplicant = {
  id: string
  name: string
  initials: string
  classYear: string
  major: string
  satScore: number
  gpa: number
  status: ScreeningStatus
  flagTags: string[]
}

export const screeningApplicants: ScreeningApplicant[]  = []

export type InterviewQuestion = {
  id: string
  label: string
  duration: string
  prompt: string
  benchmarks?: string[]
}

export type PastRoundNote = {
  round: string
  interviewer: string
  note: string
}

export type InterviewCandidate = {
  id: string
  name: string
  initials: string
  targetRole: string
  round: string
  activeRoundId: string
  location: string
  major: string
  year: string
  satScore: number
  gpa: string
  linkedin: string
  bio: string
  experience: string[]
  skills: string[]
  essays: { question: string; answer: string }[]
  pastRoundNotes: PastRoundNote[]
}

export type NextInQueue = {
  name: string
  time: string
}

export const nextCandidateInQueue: NextInQueue = {
  name: "Liam Walsh",
  time: "10:20 AM",
}

export const interviewCandidate: InterviewCandidate = {
  id: "ic-1",
  name: "Alex Chen",
  initials: "AC",
  targetRole: "Junior Analyst",
  round: "Round 1",
  activeRoundId: "round-1",
  location: "Shannon 318C",
  major: "Finance & CS",
  year: "Sophomore",
  satScore: 1520,
  gpa: "3.88",
  linkedin: "linkedin.com/in/alexchen",
  bio: "Sophomore double-majoring in Finance and Computer Science. Builds small trading backtests for fun and is looking for a rigorous team to pressure-test investment ideas with.",
  experience: ["Investment Banking Summer Analyst — Piper Sandler (2025)", "Treasurer, UVA Quant Club (2024—Present)"],
  skills: ["Financial Modeling", "Python", "Market Sizing", "SQL"],
  essays: [
    {
      question: "Why VCG?",
      answer:
        "I want to work alongside people who will argue with my thesis in good faith. VCG's real-capital mandate means every recommendation has to survive scrutiny, and I want to build that discipline early.",
    },
    {
      question: "Describe a difficult team challenge.",
      answer:
        "On a case team, a member consistently missed deadlines. Instead of escalating immediately, I had a direct 1:1 to understand the bottleneck — they were overloaded elsewhere — and we restructured the workload split. The team hit the deadline and the member became one of our strongest contributors.",
    },
  ],
  pastRoundNotes: [
    { round: "Screening Round", interviewer: "Grace Liu", note: "Strong SAT/GPA, clean essays. Sharp on the market-sizing sample question during phone screen. Recommend advancing." },
  ],
}

export const interviewQuestions: InterviewQuestion[]  = []

export type CollaboratorComment = {
  interviewer: string
  initials: string
  score: number
  note: string
}

export type WorkspaceQuestion = {
  id: string
  prompt: string
  collaboratorComments: CollaboratorComment[]
}

export type WorkspaceRound = {
  id: string
  label: string
  questions: WorkspaceQuestion[]
}

export const workspaceRounds: WorkspaceRound[]  = []

export type MemberRole = "President / Super Admin" | "Recruitment Lead / Evaluator" | "General Member"

export type RosterMember = {
  id: string
  name: string
  initials: string
  email: string
  role: MemberRole
  canViewSensitiveData: boolean
  canScoreInterviews: boolean
  canEditQuestions: boolean
}

export const rosterMembers: RosterMember[]  = []

export type ClubExecutive = {
  id: string
  name: string
  initials: string
  title: string
}

export const clubExecutives: ClubExecutive[]  = []

export type ClubPublicPageDetails = {
  name: string
  tagline: string
  aboutUs: string
  logoUrl: string | null
}

export const initialClubPublicPageDetails: ClubPublicPageDetails = {
  name: "Virginia Venture Fund",
  tagline: "UVA's student-run venture capital fund",
  aboutUs:
    "The Virginia Venture Fund is a student-managed venture capital fund investing real capital in early-stage startups founded by UVA students and alumni. Members conduct diligence, source deals, and sit alongside experienced venture partners to evaluate founders and markets.",
  logoUrl: null,
}

export type BuilderQuestionType = "essay" | "file-upload" | "multiple-choice"

export type BuilderQuestion = {
  id: string
  type: BuilderQuestionType
  prompt: string
  required: boolean
  enforceWordCount?: boolean
  minWords?: number
  maxWords?: number
  allowedFileTypes?: string
  maxFileSizeMb?: number
  options?: string[]
}

export const initialBuilderQuestions: BuilderQuestion[]  = []

export type ScheduleStudent = { name: string; email: string; initials: string }

export type ScheduleSlot = {
  id: string
  time: string
  capacity: number
  students: ScheduleStudent[]
}

export type ScheduleLocationBlock = {
  id: string
  location: string
  slots: ScheduleSlot[]
}

export const scheduleDate = "Monday, September 7th"

export const scheduleLocationNames = []

export type NotificationType = "Announcement" | "Interview Invite"

export type Notification = {
  eventId?: string
  createdAt?: string
  clubId?: string
  id: string
  type: NotificationType
  urgent: boolean
  club: string
  color: string
  logoUrl?: string | null
  logoText: string
  senderName: string
  senderTitle: string
  title: string
  preview: string
  body: string[]
  timestamp: string
  fullDate: string
  read: boolean
  cta?: string
  locationChange?: {
    oldLocation: string
    newLocation: string
  }
}

export const notifications: Notification[]  = []

export type ClubCategory = "Finance" | "Consulting" | "Tech/Software" | "Pre-Law" | "Impact"

export type TimeCommitment = "1-3" | "3-5" | "5+"

export type DiscoverClub = {
  id: string
  name: string
  logoUrl?: string | null
  logoText: string
  color: string
  category: string
  pitch: string
  tags: string[]
  acceptanceRate: number | null
  aumValue: number | null
  timeCommitment: TimeCommitment | null
  recommended?: boolean
}

export const discoverClubs: DiscoverClub[]  = []

export const rubricCriteria = [
  { id: "culture", label: "Culture Fit", hint: "Collaboration, curiosity, coachability" },
  { id: "experience", label: "Experience", hint: "Relevant background & technical skill" },
  { id: "case", label: "Case Study", hint: "Reasoning quality on the prompt" },
] as const

export type TrackerStatus = "Drafting" | "Submitted" | "In Review" | "Interviewing" | "Accepted" | "Rejected" | "Waitlisted" | "1st Round Interview" | "Decision Pending"

export type TrackedApplication = {
  id: string
  clubId: string
  clubName: string
  logoUrl?: string | null
  logoText: string
  color: string
  status: TrackerStatus
  questionsCompleted: number
  questionsTotal: number
  nextDeadline: string
  dueInHours: number
}

export const trackedApplications: TrackedApplication[]  = []

export type EssayPrompt = {
  id: string
  clubId: string
  clubName: string
  logoUrl?: string | null
  logoText: string
  color: string
  promptGroup: string
  question: string
  answer: string
  wordLimit: number
}

export const essayPrompts: EssayPrompt[]  = []

export type DecisionRecord = {
  id: string
  clubName: string
  logoUrl?: string | null
  logoText: string
  color: string
  cycle: string
  outcome: "Accepted" | "Rejected" | "Waitlisted"
  decisionDate: string
  feedback: string
}

export const decisionHistory: DecisionRecord[]  = []

export type BrandingClubCategory =
  | "Finance & Investing"
  | "Consulting"
  | "Tech & Engineering"
  | "Impact & Social Enterprise"
  | "Pre-Professional / Greek"
  | "Sports & Recreation"

export const clubCategories: BrandingClubCategory[] = [
  "Finance & Investing",
  "Consulting",
  "Tech & Engineering",
  "Impact & Social Enterprise",
  "Pre-Professional / Greek",
  "Sports & Recreation",
]

export const brandColorPresets = [
  { name: "UVA Navy", hex: "#232D4B" },
  { name: "Rotunda Orange", hex: "#EAAA00" },
  { name: "Forest Green", hex: "#1B5E3F" },
  { name: "Electric Blue", hex: "#0B63E5" },
  { name: "Crimson", hex: "#A6192E" },
]

export type Accolade = { id: string; text: string }

export type ClubBrandingProfile = {
  name: string
  tagline: string
  category: BrandingClubCategory
  logoUrl: string | null
  bannerUrl: string | null
  accentColor: string
  acceptanceRate: string
  aum: string
  displayAum: boolean
  memberCount: string
  placements: string[]
  accolades: Accolade[]
  website: string
  linkedin: string
  instagram: string
  contactEmail: string
}

export type ScoringMetric = "1-5 Scale" | "1-10 Scale" | "Pass/Fail"

export const SCORING_METRICS: ScoringMetric[] = ["1-5 Scale", "1-10 Scale", "Pass/Fail"]

export const ROUND_DURATIONS = ["15 minutes", "20 minutes", "30 minutes", "45 minutes", "60 minutes"]

export type PipelineQuestion = {
  id: string
  text: string
}

export type PipelineRound = {
  id: string
  name: string
  duration: string
  scoringMetric: ScoringMetric
  questions: PipelineQuestion[]
}

export const initialPipelineRounds: PipelineRound[] = [
  {
    id: "pr-1",
    name: "Round 1: Behavioral",
    duration: "20 minutes",
    scoringMetric: "1-5 Scale",
    questions: [
      { id: "prq-1", text: "Walk me through why you want to join this club." },
      { id: "prq-2", text: "Tell me about a time you worked through conflict on a team." },
      { id: "prq-3", text: "What's a mistake you made and what did you learn from it?" },
    ],
  },
  {
    id: "pr-2",
    name: "Round 2: Technical",
    duration: "30 minutes",
    scoringMetric: "1-10 Scale",
    questions: [
      { id: "prq-4", text: "Walk through a valuation or model you've built." },
      { id: "prq-5", text: "Pitch a long or short idea and defend it under pushback." },
    ],
  },
  {
    id: "pr-3",
    name: "Round 3: Partner Chat",
    duration: "15 minutes",
    scoringMetric: "Pass/Fail",
    questions: [{ id: "prq-6", text: "Any final questions for us? General fit conversation." }],
  },
]

export const initialClubBrandingProfile: ClubBrandingProfile = {
  name: "Portico Impact Fund",
  tagline: "UVA's premier student-run ESG investment fund",
  category: "Finance & Investing",
  logoUrl: null,
  bannerUrl: null,
  accentColor: "#232D4B",
  acceptanceRate: "8%",
  aum: "150,000",
  displayAum: true,
  memberCount: "45",
  placements: ["Goldman Sachs", "Citadel", "McKinsey", "Morgan Stanley"],
  accolades: [
    { id: "acc-1", text: "2025 National Stock Pitch Champions" },
    { id: "acc-2", text: "Best CIO 2024" },
  ],
  website: "porticoimpactfund.com",
  linkedin: "linkedin.com/company/portico-impact-fund",
  instagram: "@porticoimpact",
  contactEmail: "exec@porticoimpact.virginia.edu",
}

export type BroadcastAudience = "Subscribed Followers" | "Active Applicants" | "Accepted Members"

export const BROADCAST_AUDIENCES: BroadcastAudience[] = [
  "Subscribed Followers",
  "Active Applicants",
  "Accepted Members",
]

export type BroadcastType = "General Announcement" | "Location/Time Change" | "Urgent Deadline Alert"

export const BROADCAST_TYPES: BroadcastType[] = [
  "General Announcement",
  "Location/Time Change",
  "Urgent Deadline Alert",
]

export type SentBroadcast = {
  id: string
  dateSent: string
  audiences: BroadcastAudience[]
  subject: string
  type: BroadcastType
  deliveredPercent: number
  recipients: number
}

export const sentBroadcasts: SentBroadcast[] = [
  {
    id: "bc-1",
    dateSent: "Sep 15, 2026 · 4:12 PM",
    audiences: ["Active Applicants"],
    subject: "Round 2 Interview Location Changed",
    type: "Location/Time Change",
    deliveredPercent: 98,
    recipients: 142,
  },
  {
    id: "bc-2",
    dateSent: "Sep 12, 2026 · 9:00 AM",
    audiences: ["Subscribed Followers", "Active Applicants"],
    subject: "Info Session Reminder — Tonight at 7 PM",
    type: "General Announcement",
    deliveredPercent: 100,
    recipients: 486,
  },
  {
    id: "bc-3",
    dateSent: "Sep 9, 2026 · 6:30 PM",
    audiences: ["Active Applicants"],
    subject: "Final Application Deadline is Friday",
    type: "Urgent Deadline Alert",
    deliveredPercent: 96,
    recipients: 231,
  },
  {
    id: "bc-4",
    dateSent: "Sep 3, 2026 · 11:45 AM",
    audiences: ["Accepted Members"],
    subject: "Welcome to the Fund — Onboarding Details",
    type: "General Announcement",
    deliveredPercent: 100,
    recipients: 42,
  },
  {
    id: "bc-5",
    dateSent: "Aug 29, 2026 · 3:20 PM",
    audiences: ["Subscribed Followers"],
    subject: "Applications Open for Fall Recruitment",
    type: "General Announcement",
    deliveredPercent: 99,
    recipients: 612,
  },
]

export type EventScope = "Public" | "Members Only"

export type ManagedEvent = {
  id: string
  clubId: string
  title: string
  scope: EventScope
  date: string
  time: string
  location: string
  zoomLink?: string
  recurring?: boolean
  recurrenceLabel?: string
}

/** Public info sessions and internal member meetings, managed in Club Settings. */
export const managedEvents: ManagedEvent[]  = []

export type AgendaDocument = {
  id: string
  clubId: string
  title: string
  date: string
  fileName: string
}

/** Downloadable meeting agendas, visible to members inside their Member Portal. */
export const agendaDocuments: AgendaDocument[] = [
  { id: "ag-1", clubId: "vvf", title: "Portfolio Review — Sep 16 Agenda", date: "Sep 16", fileName: "VVF_Agenda_Sep16.pdf" },
  { id: "ag-2", clubId: "vvf", title: "Portfolio Review — Sep 9 Agenda", date: "Sep 9", fileName: "VVF_Agenda_Sep9.pdf" },
  { id: "ag-3", clubId: "meridian", title: "Fund Meeting — Sep 17 Agenda", date: "Sep 17", fileName: "Meridian_Agenda_Sep17.pdf" },
  { id: "ag-4", clubId: "helix", title: "Sprint Kickoff — Sep 15 Agenda", date: "Sep 15", fileName: "Helix_Agenda_Sep15.pdf" },
]

export type MemberAnnouncement = {
  id: string
  clubId: string
  title: string
  body: string
  date: string
}

/** Internal announcements visible strictly to verified active members. */
export const memberAnnouncements: MemberAnnouncement[] = [
  {
    id: "ma-1",
    clubId: "vvf",
    title: "New due-diligence template live",
    body: "Use the updated diligence memo template for all Q4 deal reviews — linked in the shared drive.",
    date: "Sep 14",
  },
  {
    id: "ma-2",
    clubId: "vvf",
    title: "Portfolio company site visit sign-ups open",
    body: "Sign up for the Charlottesville portfolio company visit on Oct 3. Limited to 10 members.",
    date: "Sep 11",
  },
  {
    id: "ma-3",
    clubId: "meridian",
    title: "Bloomberg Terminal access renewed",
    body: "All active members now have Bloomberg Terminal access through the Rouss Hall lab through December.",
    date: "Sep 12",
  },
  {
    id: "ma-4",
    clubId: "helix",
    title: "Capstone team assignments posted",
    body: "Check the roster channel for your capstone team and engineering partner assignment.",
    date: "Sep 10",
  },
]
