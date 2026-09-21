export type Stage = "Draft" | "Applied" | "Round 1" | "Round 2" | "Decision"

export const STAGES: Stage[] = ["Applied", "Round 1", "Round 2", "Decision"]

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

export const clubs: Club[] = [
  {
    id: "meridian",
    name: "Meridian Capital Group",
    tagline: "Student-run investment fund",
    logoText: "MC",
    color: "#2563eb",
    acceptanceRate: "6%",
    aum: "$1.4M",
    members: 42,
    description:
      "Meridian Capital Group is a student-managed investment fund overseeing a real, university-endowed portfolio. Members run fundamental research, pitch long/short theses, and manage risk across equities and fixed income.",
    exec: [
      { name: "Priya Nadar", role: "President", initials: "PN" },
      { name: "Marcus Bell", role: "CIO", initials: "MB" },
      { name: "Elena Ruiz", role: "VP, Research", initials: "ER" },
    ],
  },
  {
    id: "vanguard",
    name: "Vanguard Consulting Collective",
    tagline: "Pro-bono strategy consulting",
    logoText: "VC",
    color: "#0891b2",
    acceptanceRate: "9%",
    aum: "—",
    members: 55,
    description:
      "Vanguard pairs student teams with startups and nonprofits to deliver strategy, operations, and go-to-market engagements. Members rotate through case teams led by trained project managers.",
    exec: [
      { name: "Daniel Okafor", role: "Managing Director", initials: "DO" },
      { name: "Sophie Tran", role: "Head of Casing", initials: "ST" },
    ],
  },
  {
    id: "helix",
    name: "Helix Product Society",
    tagline: "Product management & design",
    logoText: "HX",
    color: "#7c3aed",
    acceptanceRate: "12%",
    aum: "—",
    members: 60,
    description:
      "Helix trains the next generation of product leaders through hands-on sprints, PM shadowing, and a semester-long capstone shipped with a real engineering team.",
    exec: [
      { name: "Aisha Khan", role: "President", initials: "AK" },
      { name: "Leo Park", role: "VP, Design", initials: "LP" },
    ],
  },
  {
    id: "quantum",
    name: "Quantum Trading Club",
    tagline: "Quantitative & algorithmic trading",
    logoText: "QT",
    color: "#db2777",
    acceptanceRate: "5%",
    aum: "$320K",
    members: 28,
    description:
      "Quantum builds and backtests systematic trading strategies. Members work in Python, compete in trading challenges, and interview with top quant firms.",
    exec: [
      { name: "Ravi Menon", role: "President", initials: "RM" },
      { name: "Grace Liu", role: "Head of Research", initials: "GL" },
    ],
  },
]

export const featuredClub = {
  name: "Virginia Venture Fund",
  tagline: "UVA's student-run venture capital fund",
  logoText: "VVF",
  color: "#1e3a5f",
  acceptanceRate: "8%",
  aum: "$100,000",
  topPlacements: ["Citadel", "Wells Fargo", "McKinsey"],
  description:
    "The Virginia Venture Fund is a student-managed venture capital fund investing real capital in early-stage startups founded by UVA students and alumni. Members conduct diligence, source deals, and sit alongside experienced venture partners to evaluate founders and markets.",
  whatWeLookFor: ["Analytical rigor", "Founder empathy", "Clear written communication", "Long-term thinking"],
  members: [
    { name: "Caroline Hayes", role: "Managing Partner", initials: "CH" },
    { name: "Wesley Tang", role: "VP, Diligence", initials: "WT" },
    { name: "Amara Okonjo", role: "VP, Portfolio", initials: "AO" },
    { name: "Nate Fischer", role: "Director, Sourcing", initials: "NF" },
  ],
}

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

export const applications: Application[] = [
  {
    id: "app-0",
    clubId: "vvf",
    clubName: "Virginia Venture Fund",
    logoText: "VVF",
    color: "#051B3D",
    stage: "Draft",
    nextStep: "Finish remaining essay and submit",
    submitted: "",
    deadline: "Due in 2 days",
    essaysWritten: 2,
    essaysTotal: 3,
  },
  {
    id: "app-0b",
    clubId: "helix",
    clubName: "Helix Product Society",
    logoText: "HX",
    color: "#7c3aed",
    stage: "Draft",
    nextStep: "Complete resume upload and short answers",
    submitted: "",
    deadline: "Due in 5 days",
    essaysWritten: 1,
    essaysTotal: 2,
  },
  {
    id: "app-1",
    clubId: "meridian",
    clubName: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    stage: "Round 2",
    nextStep: "Final case interview — Fri 3:00 PM",
    submitted: "Sep 2",
  },
  {
    id: "app-2",
    clubId: "vanguard",
    clubName: "Vanguard Consulting Collective",
    logoText: "VC",
    color: "#0891b2",
    stage: "Round 1",
    nextStep: "Coffee chat with case lead — Wed",
    submitted: "Sep 4",
  },
  {
    id: "app-4",
    clubId: "quantum",
    clubName: "Quantum Trading Club",
    logoText: "QT",
    color: "#db2777",
    stage: "Decision",
    outcome: "Accepted",
    nextStep: "Offer received — respond by Sep 20",
    submitted: "Aug 28",
  },
]

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
export const studentMemberships: StudentMembership[] = [
  {
    clubId: "vvf",
    clubName: "Virginia Venture Fund",
    logoText: "VVF",
    color: "#1e3a5f",
    role: "Executive",
    title: "VP of Recruitment",
  },
  {
    clubId: "meridian",
    clubName: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    role: "Member",
  },
  {
    clubId: "helix",
    clubName: "Helix Product Society",
    logoText: "HX",
    color: "#7c3aed",
    role: "Member",
  },
]

export type ExperienceItem = {
  id: string
  title: string
  subtitle: string
  period: string
}

export const experienceItems: ExperienceItem[] = [
  { id: "exp-1", title: "Equity Research Summer Analyst", subtitle: "Fidelity Investments", period: "Summer 2025" },
  { id: "exp-2", title: "Treasurer", subtitle: "UVA Investing Society", period: "2024 — Present" },
  { id: "exp-3", title: "Dean's List, 3 semesters", subtitle: "College of Arts & Sciences", period: "2023 — 2025" },
]

export type EventType = "Deadline" | "Interest Meeting" | "Coffee Chat" | "Interview"

export type ClubEvent = {
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
export const events: ClubEvent[] = [
  { id: "e1", clubId: "helix", date: "2026-09-03", day: 3, title: "Helix Interest Meeting", club: "Helix Product Society", color: "#7c3aed", type: "Interest Meeting", time: "6:00 PM" },
  { id: "e2", clubId: "helix", date: "2026-09-24", day: 24, title: "Helix Application Due", club: "Helix Product Society", color: "#7c3aed", type: "Deadline", time: "11:59 PM" },
  { id: "e3", clubId: "vanguard", date: "2026-09-23", day: 23, title: "Vanguard Coffee Chat", club: "Vanguard Consulting Collective", color: "#0891b2", type: "Coffee Chat", time: "2:30 PM" },
  { id: "e4", clubId: "meridian", date: "2026-09-25", day: 25, title: "Meridian Round 2 Interview", club: "Meridian Capital Group", color: "#2563eb", type: "Interview", time: "3:00 PM" },
  { id: "e5", clubId: "quantum", date: "2026-09-20", day: 20, title: "Quantum Offer Deadline", club: "Quantum Trading Club", color: "#db2777", type: "Deadline", time: "5:00 PM" },
  { id: "e6", clubId: "vanguard", date: "2026-09-24", day: 24, title: "Vanguard Case Workshop", club: "Vanguard Consulting Collective", color: "#0891b2", type: "Interest Meeting", time: "7:00 PM" },
]

export type CoffeeChatRequest = {
  id: string
  leaderName: string
  leaderInitials: string
  clubName: string
  color: string
  status: "Pending" | "Confirmed"
  proposedSlots: string[]
}

export const coffeeChatRequests: CoffeeChatRequest[] = [
  {
    id: "cc-1",
    leaderName: "Priya Nadar",
    leaderInitials: "PN",
    clubName: "Meridian Capital Group",
    color: "#2563eb",
    status: "Pending",
    proposedSlots: ["Wed, Sep 17 · 4:00 PM", "Wed, Sep 17 · 5:30 PM", "Thu, Sep 18 · 1:00 PM", "Fri, Sep 19 · 2:30 PM"],
  },
  {
    id: "cc-2",
    leaderName: "Sophie Tran",
    leaderInitials: "ST",
    clubName: "Vanguard Consulting Collective",
    color: "#0891b2",
    status: "Pending",
    proposedSlots: ["Thu, Sep 18 · 3:00 PM", "Fri, Sep 19 · 11:00 AM", "Fri, Sep 19 · 4:00 PM"],
  },
]

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

export const applicants: Applicant[] = [
  {
    id: "ap-1",
    name: "Jordan Avery",
    email: "jda4bg@virginia.edu",
    initials: "JA",
    major: "Economics & CS",
    year: "Junior",
    status: "Round 2",
    score: 4.3,
    gpa: "3.87",
    satScore: 1510,
    resumeFileName: "Jordan_Avery_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/jordanavery" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer:
          "I want the discipline of managing real capital alongside people who argue about theses in good faith. Last summer in equity research I learned that conviction has to survive a skeptical room. I'd contribute rigorous, source-driven pitches and a willingness to be wrong loudly and early.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer:
          "I'm long a specialty-insurer trading below book despite improving combined ratios. The market is over-anchored on a single catastrophe year; normalized underwriting plus a hardening rate cycle suggests mid-teens ROE is durable, and buybacks below book are quietly accretive.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer:
          "I was bearish on a retailer until store-level traffic data and a management transcript convinced me the turnaround was operational, not cosmetic. I closed the short and wrote up why my original thesis mispriced execution risk.",
      },
    ],
  },
  {
    id: "ap-2",
    name: "Naomi Cho",
    email: "nc8fw@virginia.edu",
    initials: "NC",
    major: "Finance",
    year: "Sophomore",
    status: "Round 1",
    score: 3.9,
    gpa: "3.92",
    satScore: 1490,
    resumeFileName: "Naomi_Cho_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/naomicho" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer:
          "I run a small dividend-growth portfolio and want to pressure-test my process against people smarter than me. I'd bring strong modeling fundamentals and a habit of writing tight, one-page memos.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer:
          "Long a payments network with pricing power and secular volume growth; the multiple compressed on regulatory fear that I think overstates the earnings impact.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer:
          "I abandoned a momentum strategy after backtesting showed the returns disappeared once realistic transaction costs were applied.",
      },
    ],
  },
  {
    id: "ap-3",
    name: "Theo Marsh",
    email: "tm5rk@virginia.edu",
    initials: "TM",
    major: "Mathematics",
    year: "Junior",
    status: "Accepted",
    score: 4.7,
    gpa: "3.95",
    satScore: 1560,
    resumeFileName: "Theo_Marsh_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/theomarsh" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer:
          "I care about the intersection of quantitative rigor and narrative. I'd contribute statistical grounding to fundamental pitches so we know which edges are real and which are noise.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer:
          "Short a heavily-shorted meme name is crowded, so instead I'd pair-trade two industrials where the spread has decoupled from their historical cointegration.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer:
          "I stopped trusting a factor model after realizing it was overfit to a single decade of data.",
      },
    ],
  },
  {
    id: "ap-4",
    name: "Sofia Reyes",
    email: "sr9jm@virginia.edu",
    initials: "SR",
    major: "Business Analytics",
    year: "Senior",
    status: "Applied",
    score: 0,
    gpa: "3.78",
    satScore: 1430,
    resumeFileName: "Sofia_Reyes_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/sofiareyes" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer:
          "As a senior I want one more year of building something that outlasts me — mentoring underclassmen and formalizing our research playbook.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer:
          "Long a data-infrastructure company where net revenue retention above 120% is being priced like a mature software business.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer:
          "I revised a valuation upward after a cohort analysis showed churn was concentrated in a segment management was already exiting.",
      },
    ],
  },
  {
    id: "ap-5",
    name: "Elijah Grant",
    email: "eg2vb@virginia.edu",
    initials: "EG",
    major: "Economics",
    year: "Sophomore",
    status: "Rejected",
    score: 2.6,
    gpa: "3.4",
    satScore: 1360,
    resumeFileName: "Elijah_Grant_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/elijahgrant" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer: "I think investing is interesting and I want to learn more about the stock market and finance in general.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer: "I like big tech companies because they always go up over time and have strong brands.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer: "I used to only buy stocks I heard about from friends but now I try to read the news first.",
      },
    ],
  },
  {
    id: "ap-6",
    name: "Hannah Weiss",
    email: "hw3qx@virginia.edu",
    initials: "HW",
    major: "Applied Math & Econ",
    year: "Junior",
    status: "Round 2",
    score: 4.1,
    gpa: "3.89",
    satScore: 1500,
    resumeFileName: "Hannah_Weiss_Resume.pdf",
    links: [{ label: "LinkedIn", url: "linkedin.com/in/hannahweiss" }],
    essays: [
      {
        question: "Why do you want to join Meridian, and what will you contribute?",
        answer:
          "I want to translate academic finance into decisions with real stakes. I'd contribute clean DCFs, sensitivity work, and a calm presence in interviews.",
      },
      {
        question: "Walk us through an investment idea you find compelling.",
        answer:
          "Long a regional bank oversold in a deposit-flight panic; its funding base is stickier than peers and it trades at a discount to tangible book with no credit issues.",
      },
      {
        question: "Describe a time you changed your mind based on evidence.",
        answer:
          "I dropped a housing-short thesis after the data showed supply was structurally constrained, not cyclically tight.",
      },
    ],
  },
]

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

export const screeningApplicants: ScreeningApplicant[] = [
  { id: "sc-1", name: "Marcus Webb", initials: "MW", classYear: "2027", major: "Commerce", satScore: 1540, gpa: 3.92, status: "Passed Auto-Filter", flagTags: [] },
  { id: "sc-2", name: "Isabella Cruz", initials: "IC", classYear: "2028", major: "Economics", satScore: 1510, gpa: 3.88, status: "Manually Approved", flagTags: [] },
  { id: "sc-3", name: "Owen Patel", initials: "OP", classYear: "2026", major: "Finance", satScore: 1390, gpa: 3.41, status: "Auto-Flagged", flagTags: ["Low SAT", "Low GPA"] },
  { id: "sc-4", name: "Zara Ahmed", initials: "ZA", classYear: "2027", major: "Commerce", satScore: 1470, gpa: 3.76, status: "Passed Auto-Filter", flagTags: [] },
  { id: "sc-5", name: "Liam Oduya", initials: "LO", classYear: "2026", major: "Economics", satScore: 1420, gpa: 3.3, status: "Rejected", flagTags: ["Low GPA"] },
  { id: "sc-6", name: "Grace Kim", initials: "GK", classYear: "2028", major: "Systems Engineering", satScore: 1560, gpa: 3.95, status: "Passed Auto-Filter", flagTags: [] },
  { id: "sc-7", name: "Dominic Ferrara", initials: "DF", classYear: "2027", major: "Finance", satScore: 1380, gpa: 3.55, status: "Auto-Flagged", flagTags: ["Low SAT"] },
  { id: "sc-8", name: "Priya Suresh", initials: "PS", classYear: "2028", major: "Commerce", satScore: 1500, gpa: 3.81, status: "Passed Auto-Filter", flagTags: [] },
  { id: "sc-9", name: "Noah Bergstrom", initials: "NB", classYear: "2026", major: "Economics", satScore: 1440, gpa: 3.38, status: "Rejected", flagTags: ["Low GPA"] },
  { id: "sc-10", name: "Amelia Chen", initials: "AC", classYear: "2027", major: "Statistics", satScore: 1520, gpa: 3.9, status: "Manually Approved", flagTags: [] },
  { id: "sc-11", name: "Tobias Reinholt", initials: "TR", classYear: "2028", major: "Finance", satScore: 1350, gpa: 3.28, status: "Auto-Flagged", flagTags: ["Low SAT", "Low GPA"] },
  { id: "sc-12", name: "Simone Laurent", initials: "SL", classYear: "2027", major: "Commerce", satScore: 1480, gpa: 3.71, status: "Passed Auto-Filter", flagTags: [] },
]

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

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: "q1",
    label: "Question 1 · Behavioral",
    duration: "5 min",
    prompt: "Tell us about a time you had to deal with a conflicting team member.",
  },
  {
    id: "q2",
    label: "Question 2 · Technical / Case",
    duration: "10 min",
    prompt: "How would you estimate the market size for electric scooters in Charlottesville?",
    benchmarks: ["Market Sizing", "Population breakdown", "Seasonality"],
  },
  {
    id: "q3",
    label: "Question 3 · Culture Fit & Pitch",
    duration: "5 min",
    prompt: "Pitch us one stock or project idea you care about.",
  },
]

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

export const workspaceRounds: WorkspaceRound[] = [
  {
    id: "round-1",
    label: "Round 1: Behavioral",
    questions: [
      {
        id: "r1-q1",
        prompt: "Tell us about a time you had to deal with a conflicting team member.",
        collaboratorComments: [
          {
            interviewer: "Sarah Kim",
            initials: "SK",
            score: 4,
            note: "Great communication, slightly nervous.",
          },
        ],
      },
      {
        id: "r1-q2",
        prompt: "Why do you want to join this club, and what will you contribute?",
        collaboratorComments: [],
      },
    ],
  },
  {
    id: "round-2",
    label: "Round 2: Technical / Case",
    questions: [
      {
        id: "r2-q1",
        prompt: "Pitch me a stock you are currently following.",
        collaboratorComments: [
          {
            interviewer: "Marcus Bell",
            initials: "MB",
            score: 5,
            note: "Sharp thesis, clean numbers, handled pushback well.",
          },
        ],
      },
      {
        id: "r2-q2",
        prompt: "How would you estimate the market size for electric scooters in Charlottesville?",
        collaboratorComments: [],
      },
    ],
  },
  {
    id: "round-3",
    label: "Round 3: Partner",
    questions: [
      {
        id: "r3-q1",
        prompt: "What's a belief you hold that most of your peers would disagree with?",
        collaboratorComments: [],
      },
    ],
  },
]

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

export const rosterMembers: RosterMember[] = [
  {
    id: "rm-1",
    name: "Priya Nadar",
    initials: "PN",
    email: "pn4gk@virginia.edu",
    role: "President / Super Admin",
    canViewSensitiveData: true,
    canScoreInterviews: true,
    canEditQuestions: true,
  },
  {
    id: "rm-2",
    name: "Marcus Bell",
    initials: "MB",
    email: "mb9wr@virginia.edu",
    role: "President / Super Admin",
    canViewSensitiveData: true,
    canScoreInterviews: true,
    canEditQuestions: true,
  },
  {
    id: "rm-3",
    name: "Elena Ruiz",
    initials: "ER",
    email: "er6tp@virginia.edu",
    role: "Recruitment Lead / Evaluator",
    canViewSensitiveData: true,
    canScoreInterviews: true,
    canEditQuestions: false,
  },
  {
    id: "rm-4",
    name: "Grace Liu",
    initials: "GL",
    email: "gl3mx@virginia.edu",
    role: "Recruitment Lead / Evaluator",
    canViewSensitiveData: true,
    canScoreInterviews: true,
    canEditQuestions: false,
  },
  {
    id: "rm-5",
    name: "Dominic Ferrara",
    initials: "DF",
    email: "df7ny@virginia.edu",
    role: "Recruitment Lead / Evaluator",
    canViewSensitiveData: true,
    canScoreInterviews: false,
    canEditQuestions: false,
  },
  {
    id: "rm-6",
    name: "Sofia Reyes",
    initials: "SR",
    email: "sr2qc@virginia.edu",
    role: "General Member",
    canViewSensitiveData: false,
    canScoreInterviews: false,
    canEditQuestions: false,
  },
  {
    id: "rm-7",
    name: "Elijah Grant",
    initials: "EG",
    email: "eg8hd@virginia.edu",
    role: "General Member",
    canViewSensitiveData: false,
    canScoreInterviews: false,
    canEditQuestions: false,
  },
  {
    id: "rm-8",
    name: "Hannah Weiss",
    initials: "HW",
    email: "hw5vb@virginia.edu",
    role: "General Member",
    canViewSensitiveData: false,
    canScoreInterviews: false,
    canEditQuestions: false,
  },
]

export type ClubExecutive = {
  id: string
  name: string
  initials: string
  title: string
}

export const clubExecutives: ClubExecutive[] = [
  { id: "exec-1", name: "Priya Nadar", initials: "PN", title: "President" },
  { id: "exec-2", name: "Marcus Bell", initials: "MB", title: "Chief Investment Officer" },
  { id: "exec-3", name: "Elena Ruiz", initials: "ER", title: "VP of Finance" },
  { id: "exec-4", name: "Grace Liu", initials: "GL", title: "VP of Recruitment" },
  { id: "exec-5", name: "Dominic Ferrara", initials: "DF", title: "VP of Research" },
]

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

export const initialBuilderQuestions: BuilderQuestion[] = [
  {
    id: "bq-1",
    type: "essay",
    prompt: "Why do you want to join Meridian Capital Group, and what will you contribute?",
    required: true,
    enforceWordCount: true,
    minWords: 100,
    maxWords: 300,
  },
  {
    id: "bq-2",
    type: "file-upload",
    prompt: "Upload a 60-second stock pitch video or a 1-page pitch deck.",
    required: true,
    allowedFileTypes: "Video Files (.mp4, .mov)",
    maxFileSizeMb: 500,
  },
  {
    id: "bq-3",
    type: "multiple-choice",
    prompt: "Which sector team do you prefer?",
    required: false,
    options: ["Tech", "Healthcare", "Energy", "Financials"],
  },
]

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

export const scheduleLocationNames = ["Shannon 318C", "Bodo's on Corner", "RRH Courtyard"]

export const scheduleLocations: ScheduleLocationBlock[] = [
  {
    id: "loc-1",
    location: "Shannon 318C",
    slots: [
      {
        id: "s1",
        time: "10:00 AM",
        capacity: 2,
        students: [{ name: "Naomi Cho", email: "nc8fk@virginia.edu", initials: "NC" }],
      },
      {
        id: "s2",
        time: "10:20 AM",
        capacity: 2,
        students: [
          { name: "Riley Huang", email: "rwh2yd@virginia.edu", initials: "RH" },
          { name: "Liam Walsh", email: "liam.walsh@virginia.edu", initials: "LW" },
        ],
      },
      { id: "s3", time: "10:40 AM", capacity: 2, students: [] },
      { id: "s4", time: "11:00 AM", capacity: 2, students: [] },
      { id: "s5", time: "11:20 AM", capacity: 2, students: [] },
    ],
  },
  {
    id: "loc-2",
    location: "Bodo's on Corner",
    slots: [
      {
        id: "s6",
        time: "10:00 AM",
        capacity: 2,
        students: [{ name: "Priya Suresh", email: "ps4ty@virginia.edu", initials: "PS" }],
      },
      { id: "s7", time: "10:20 AM", capacity: 2, students: [] },
      { id: "s8", time: "10:40 AM", capacity: 2, students: [] },
    ],
  },
  {
    id: "loc-3",
    location: "RRH Courtyard",
    slots: [
      { id: "s9", time: "1:00 PM", capacity: 2, students: [] },
      { id: "s10", time: "1:20 PM", capacity: 2, students: [] },
    ],
  },
]

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

export const notifications: Notification[] = [
  {
    id: "n-1",
    eventId: "vvf-location-update",
    type: "Announcement",
    urgent: true,
    club: "Virginia Venture Fund",
    color: "#051B3D",
    logoText: "VVF",
    senderName: "Caroline Hayes",
    senderTitle: "Virginia Venture Fund — Managing Partner",
    title: "URGENT: Location Change for Tonight's Info Session",
    preview: "We've moved tonight's info session — new room and time inside.",
    body: [
      "Hi everyone — quick but important update ahead of tonight's info session.",
      "Facilities double-booked Minor Hall at the last minute, so we've relocated to Rouss Hall 120. Doors still open at 6:30 PM, and the session will run exactly as planned, just down the street.",
      "If you already RSVP'd, you don't need to do anything else. See you tonight!",
    ],
    timestamp: "12m ago",
    fullDate: "Sep 18, 2026 · 4:12 PM",
    createdAt: "2026-09-18T16:12:00-04:00",
    read: false,
    locationChange: {
      oldLocation: "Minor Hall",
      newLocation: "Rouss Hall 120",
    },
  },
  {
    id: "n-2",
    eventId: "e4",
    type: "Interview Invite",
    urgent: false,
    club: "Meridian Capital Group",
    clubId: "meridian",
    color: "#2563eb",
    logoText: "MC",
    senderName: "Priya Nadar",
    senderTitle: "Meridian Capital Group — President",
    title: "You're invited to your final case interview",
    preview: "Congrats on advancing — let's lock in your Round 2 time.",
    body: [
      "Congratulations on making it to the final round at Meridian Capital Group.",
      "Your case interview is confirmed for Friday at 3:00 PM with two members of our investment committee. Plan for about 45 minutes, including a live markets case and a short fit conversation.",
      "Come with a notebook and a calculator — laptops aren't needed. Reach out if the time no longer works.",
    ],
    timestamp: "2h ago",
    fullDate: "Sep 18, 2026 · 2:04 PM",
    createdAt: "2026-09-18T14:04:00-04:00",
    read: false,
    cta: "Confirm Interview Time",
  },
  {
    id: "n-3",
    eventId: "deadline-mii",
    type: "Announcement",
    urgent: true,
    club: "McIntire Investment Institute",
    color: "#b45309",
    logoText: "MII",
    senderName: "Recruitment Team",
    senderTitle: "McIntire Investment Institute — Recruitment",
    title: "Applications close in 24 hours",
    preview: "Final reminder — submit your application before tomorrow at 11:59 PM.",
    body: [
      "This is your final reminder that McIntire Investment Institute applications close tomorrow at 11:59 PM.",
      "If your resume or short answers are still in progress, we strongly recommend finishing tonight. The portal locks automatically at the deadline with no exceptions.",
    ],
    timestamp: "38m ago",
    fullDate: "Sep 18, 2026 · 3:46 PM",
    createdAt: "2026-09-18T15:46:00-04:00",
    read: false,
  },
  {
    id: "n-4",
    eventId: "e3",
    type: "Interview Invite",
    urgent: false,
    club: "Vanguard Consulting Collective",
    clubId: "vanguard",
    color: "#0891b2",
    logoText: "VC",
    senderName: "Sophie Tran",
    senderTitle: "Vanguard Consulting Collective — Head of Casing",
    title: "Coffee chat confirmed for Wednesday",
    preview: "Looking forward to chatting with you Wednesday afternoon.",
    body: [
      "Hi — just confirming our coffee chat for Wednesday at 2:30 PM in Newcomb Hall.",
      "No prep needed. Come with questions about casing, our current engagements, or what the semester looks like as a first-year analyst.",
    ],
    timestamp: "5h ago",
    fullDate: "Sep 18, 2026 · 11:20 AM",
    createdAt: "2026-09-18T11:20:00-04:00",
    read: true,
  },
  {
    id: "n-5",
    type: "Announcement",
    urgent: false,
    club: "Portico Impact Fund",
    clubId: "portico",
    color: "#15803d",
    logoText: "PIF",
    senderName: "Recruitment Team",
    senderTitle: "Portico Impact Fund — Recruitment",
    title: "We've received your application",
    preview: "Your OutClass profile, resume, and responses were submitted successfully.",
    body: [
      "Thanks for applying to Portico Impact Fund. Your OutClass profile, resume, and short-answer responses were submitted successfully.",
      "We're reviewing applications on a rolling basis and expect to send first-round decisions within two weeks.",
    ],
    timestamp: "5h ago",
    fullDate: "Sep 18, 2026 · 11:02 AM",
    createdAt: "2026-09-18T11:02:00-04:00",
    read: true,
  },
  {
    id: "n-6",
    eventId: "e5",
    type: "Announcement",
    urgent: false,
    club: "Quantum Trading Club",
    clubId: "quantum",
    color: "#db2777",
    logoText: "QT",
    senderName: "Ravi Menon",
    senderTitle: "Quantum Trading Club — President",
    title: "Offer extended — respond by Sep 20",
    preview: "Congratulations — you've been extended an offer to join Quantum.",
    body: [
      "Congratulations, Jordan — the team was impressed by your background and would like to extend you an offer to join Quantum Trading Club.",
      "Please respond by September 20th so we can finalize our incoming class roster. Let us know if you have any questions before then.",
    ],
    timestamp: "1d ago",
    fullDate: "Sep 17, 2026 · 5:40 PM",
    createdAt: "2026-09-17T17:40:00-04:00",
    read: true,
    cta: "Respond to Offer",
  },
  {
    id: "n-7",
    type: "Announcement",
    urgent: false,
    club: "Helix Product Society",
    clubId: "helix",
    color: "#7c3aed",
    logoText: "HX",
    senderName: "Recruitment Team",
    senderTitle: "Helix Product Society — Recruitment",
    title: "We've received your application",
    preview: "Your OutClass profile and resume were automatically attached.",
    body: [
      "Thanks for applying to Helix Product Society. Your OutClass profile and resume were automatically attached to your application.",
      "We'll be in touch with next steps within one week.",
    ],
    timestamp: "2d ago",
    fullDate: "Sep 16, 2026 · 9:15 AM",
    createdAt: "2026-09-16T09:15:00-04:00",
    read: true,
  },
]

export type ClubCategory = "Finance" | "Consulting" | "Tech/Software" | "Pre-Law" | "Impact"

export type TimeCommitment = "1-3" | "3-5" | "5+"

export type DiscoverClub = {
  id: string
  name: string
  logoUrl?: string | null
  logoText: string
  color: string
  category: ClubCategory
  pitch: string
  tags: string[]
  acceptanceRate: number
  aumValue: number | null
  timeCommitment: TimeCommitment
  recommended?: boolean
}

export const discoverClubs: DiscoverClub[] = [
  {
    id: "aif",
    name: "Alternative Investment Fund",
    logoText: "AIF",
    color: "#1e3a5f",
    category: "Finance",
    pitch: "Student-run fund allocating capital across private equity, credit, and real assets.",
    tags: ["Acceptance Rate: 8%", "AUM: $150K", "Target: Fall 2026"],
    acceptanceRate: 8,
    aumValue: 150000,
    timeCommitment: "3-5",
    recommended: true,
  },
  {
    id: "vcg",
    name: "Virginia Consulting Group",
    logoText: "VCG",
    color: "#0891b2",
    category: "Consulting",
    pitch: "Full-time casing practice serving Fortune 500 clients on live strategy engagements.",
    tags: ["Acceptance Rate: 11%", "Clients: 6 active", "Target: Fall 2026"],
    acceptanceRate: 11,
    aumValue: null,
    timeCommitment: "5+",
    recommended: true,
  },
  {
    id: "meridian",
    name: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    category: "Finance",
    pitch: "Student-managed investment fund overseeing a real, university-endowed portfolio.",
    tags: ["Acceptance Rate: 6%", "AUM: $1.4M", "Target: Fall 2026"],
    acceptanceRate: 6,
    aumValue: 1400000,
    timeCommitment: "5+",
    recommended: true,
  },
  {
    id: "vanguard",
    name: "Vanguard Consulting Collective",
    logoText: "VC",
    color: "#0891b2",
    category: "Consulting",
    pitch: "Pro-bono strategy consulting pairing student teams with startups and nonprofits.",
    tags: ["Acceptance Rate: 9%", "Members: 55", "Target: Fall 2026"],
    acceptanceRate: 9,
    aumValue: null,
    timeCommitment: "3-5",
  },
  {
    id: "helix",
    name: "Helix Product Society",
    logoText: "HX",
    color: "#7c3aed",
    category: "Tech/Software",
    pitch: "Hands-on product management training with a semester-long capstone.",
    tags: ["Acceptance Rate: 12%", "Members: 60", "Target: Fall 2026"],
    acceptanceRate: 12,
    aumValue: null,
    timeCommitment: "3-5",
  },
  {
    id: "quantum",
    name: "Quantum Trading Club",
    logoText: "QT",
    color: "#db2777",
    category: "Finance",
    pitch: "Systematic trading strategies built and backtested in Python.",
    tags: ["Acceptance Rate: 5%", "AUM: $320K", "Target: Fall 2026"],
    acceptanceRate: 5,
    aumValue: 320000,
    timeCommitment: "5+",
  },
  {
    id: "buildhub",
    name: "BuildHub Engineering Society",
    logoText: "BH",
    color: "#ea580c",
    category: "Tech/Software",
    pitch: "Cross-disciplinary maker collective shipping hardware projects each semester.",
    tags: ["Acceptance Rate: 18%", "Members: 74", "Target: Fall 2026"],
    acceptanceRate: 18,
    aumValue: null,
    timeCommitment: "1-3",
  },
  {
    id: "portico",
    name: "Portico Impact Fund",
    logoText: "PIF",
    color: "#15803d",
    category: "Impact",
    pitch: "Impact-first fund investing in mission-driven founders across the region.",
    tags: ["Acceptance Rate: 14%", "AUM: $80K", "Target: Fall 2026"],
    acceptanceRate: 14,
    aumValue: 80000,
    timeCommitment: "1-3",
  },
  {
    id: "codebase",
    name: "CodeBase Dev Collective",
    logoText: "CB",
    color: "#4338ca",
    category: "Tech/Software",
    pitch: "Ship production apps for local startups while learning modern engineering practice.",
    tags: ["Acceptance Rate: 22%", "Members: 48", "Target: Fall 2026"],
    acceptanceRate: 22,
    aumValue: null,
    timeCommitment: "3-5",
  },
  {
    id: "prelaw",
    name: "Cavalier Pre-Law Society",
    logoText: "CPL",
    color: "#9d174d",
    category: "Pre-Law",
    pitch: "Mock trial, LSAT prep, and mentorship from admitted law students and alumni.",
    tags: ["Acceptance Rate: 20%", "Members: 65", "Target: Fall 2026"],
    acceptanceRate: 20,
    aumValue: null,
    timeCommitment: "1-3",
  },
]

export const rubricCriteria = [
  { id: "culture", label: "Culture Fit", hint: "Collaboration, curiosity, coachability" },
  { id: "experience", label: "Experience", hint: "Relevant background & technical skill" },
  { id: "case", label: "Case Study", hint: "Reasoning quality on the prompt" },
] as const

export type TrackerStatus = "Drafting" | "Submitted" | "1st Round Interview" | "Decision Pending"

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

export const trackedApplications: TrackedApplication[] = [
  {
    id: "trk-1",
    clubId: "mii",
    clubName: "McIntire Investment Institute",
    logoText: "MII",
    color: "#b45309",
    status: "Drafting",
    questionsCompleted: 2,
    questionsTotal: 3,
    nextDeadline: "Essay 2 due",
    dueInHours: 14.5,
  },
  {
    id: "trk-2",
    clubId: "vvf",
    clubName: "Virginia Venture Fund",
    logoText: "VVF",
    color: "#1e3a5f",
    status: "1st Round Interview",
    questionsCompleted: 3,
    questionsTotal: 3,
    nextDeadline: "Interview slot selection",
    dueInHours: 22,
  },
  {
    id: "trk-3",
    clubId: "meridian",
    clubName: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    status: "Submitted",
    questionsCompleted: 3,
    questionsTotal: 3,
    nextDeadline: "Final case interview — Fri 3:00 PM",
    dueInHours: 68,
  },
  {
    id: "trk-4",
    clubId: "vanguard",
    clubName: "Vanguard Consulting Collective",
    logoText: "VC",
    color: "#0891b2",
    status: "Drafting",
    questionsCompleted: 1,
    questionsTotal: 4,
    nextDeadline: "Application closes",
    dueInHours: 96,
  },
  {
    id: "trk-5",
    clubId: "helix",
    clubName: "Helix Product Society",
    logoText: "HX",
    color: "#7c3aed",
    status: "Drafting",
    questionsCompleted: 1,
    questionsTotal: 2,
    nextDeadline: "Application closes",
    dueInHours: 120,
  },
]

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

export const essayPrompts: EssayPrompt[] = [
  {
    id: "ep-1",
    clubId: "mii",
    clubName: "McIntire Investment Institute",
    logoText: "MII",
    color: "#b45309",
    promptGroup: "why-this-club",
    question: "Why do you want to join McIntire Investment Institute?",
    answer: "",
    wordLimit: 300,
  },
  {
    id: "ep-2",
    clubId: "mii",
    clubName: "McIntire Investment Institute",
    logoText: "MII",
    color: "#b45309",
    promptGroup: "investment-pitch",
    question: "Pitch a long or short investment idea.",
    answer: "",
    wordLimit: 400,
  },
  {
    id: "ep-3",
    clubId: "vvf",
    clubName: "Virginia Venture Fund",
    logoText: "VVF",
    color: "#1e3a5f",
    promptGroup: "why-this-club",
    question: "Why VVF?",
    answer:
      "I want the discipline of managing real capital alongside people who argue about theses in good faith. VVF's early-stage focus lets me pair founder diligence with the same rigor I bring to public markets.",
    wordLimit: 250,
  },
  {
    id: "ep-4",
    clubId: "vvf",
    clubName: "Virginia Venture Fund",
    logoText: "VVF",
    color: "#1e3a5f",
    promptGroup: "stock-pitch",
    question: "Pitch a stock to us in 500 words.",
    answer:
      "I'm long a specialty-insurer trading below book despite improving combined ratios. The market is over-anchored on a single catastrophe year; normalized underwriting plus a hardening rate cycle suggests mid-teens ROE is durable, and buybacks below book are quietly accretive.",
    wordLimit: 500,
  },
  {
    id: "ep-5",
    clubId: "meridian",
    clubName: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    promptGroup: "why-this-club",
    question: "Why do you want to join Meridian, and what will you contribute?",
    answer:
      "I want the discipline of managing real capital alongside people who argue about theses in good faith. I'd contribute rigorous, source-driven pitches and a willingness to be wrong loudly and early.",
    wordLimit: 300,
  },
  {
    id: "ep-6",
    clubId: "meridian",
    clubName: "Meridian Capital Group",
    logoText: "MC",
    color: "#2563eb",
    promptGroup: "investment-pitch",
    question: "Walk us through an investment idea you find compelling.",
    answer:
      "I'm long a specialty-insurer trading below book despite improving combined ratios. Normalized underwriting plus a hardening rate cycle suggests mid-teens ROE is durable.",
    wordLimit: 400,
  },
  {
    id: "ep-7",
    clubId: "vanguard",
    clubName: "Vanguard Consulting Collective",
    logoText: "VC",
    color: "#0891b2",
    promptGroup: "why-this-club",
    question: "Why does consulting, and why Vanguard specifically, interest you?",
    answer: "",
    wordLimit: 300,
  },
  {
    id: "ep-8",
    clubId: "vanguard",
    clubName: "Vanguard Consulting Collective",
    logoText: "VC",
    color: "#0891b2",
    promptGroup: "case-reasoning",
    question: "Walk us through your approach to a market-sizing problem.",
    answer: "",
    wordLimit: 350,
  },
]

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

export const decisionHistory: DecisionRecord[] = [
  {
    id: "dh-1",
    clubName: "Quantum Trading Club",
    logoText: "QT",
    color: "#db2777",
    cycle: "Fall 2025",
    outcome: "Accepted",
    decisionDate: "Sep 20, 2025",
    feedback:
      "Interview panel noted strong Python fluency and a clear explanation of backtest overfitting risk. Coffee chat with the research lead went well — cited as a culture-fit highlight.",
  },
  {
    id: "dh-2",
    clubName: "Ridgeline Trading Desk",
    logoText: "RT",
    color: "#0f766e",
    cycle: "Spring 2025",
    outcome: "Rejected",
    decisionDate: "Feb 14, 2025",
    feedback:
      "Case interview feedback: strong structure, but the final recommendation lacked a clear risk mitigant. Encouraged to reapply after more casing practice.",
  },
  {
    id: "dh-3",
    clubName: "Bay Capital Society",
    logoText: "BC",
    color: "#7c2d12",
    cycle: "Spring 2025",
    outcome: "Waitlisted",
    decisionDate: "Feb 28, 2025",
    feedback: "Moved to waitlist after final rounds; two seats opened for admitted students who declined.",
  },
]

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
export const managedEvents: ManagedEvent[] = [
  {
    id: "ev-1",
    clubId: "vvf",
    title: "Fall Info Session #1",
    scope: "Public",
    date: "2026-09-25",
    time: "6:00 PM",
    location: "Rouss & Robertson Hall, Room 130",
    zoomLink: "https://uva.zoom.us/j/8827301",
  },
  {
    id: "ev-2",
    clubId: "vvf",
    title: "Fall Info Session #2",
    scope: "Public",
    date: "2026-09-30",
    time: "7:30 PM",
    location: "Darden School, Classroom 40",
  },
  {
    id: "ev-3",
    clubId: "vvf",
    title: "Weekly Portfolio Review",
    scope: "Members Only",
    date: "Every Tuesday",
    time: "7:00 PM",
    location: "McIntire Room 220",
    recurring: true,
    recurrenceLabel: "Every Tuesday at 7:00 PM — McIntire Room 220",
  },
  {
    id: "ev-4",
    clubId: "meridian",
    title: "Weekly Fund Meeting",
    scope: "Members Only",
    date: "Every Wednesday",
    time: "8:00 PM",
    location: "Rouss Hall, Room 210",
    recurring: true,
    recurrenceLabel: "Every Wednesday at 8:00 PM — Rouss Hall, Room 210",
    zoomLink: "https://uva.zoom.us/j/4471902",
  },
  {
    id: "ev-5",
    clubId: "meridian",
    title: "Info Session: Spring Recruiting Preview",
    scope: "Public",
    date: "2026-10-06",
    time: "6:30 PM",
    location: "Newcomb Hall Ballroom",
    zoomLink: "https://uva.zoom.us/j/2210594",
  },
  {
    id: "ev-6",
    clubId: "helix",
    title: "Product Sprint Kickoff",
    scope: "Members Only",
    date: "Every Monday",
    time: "6:30 PM",
    location: "Rice Hall, Room 032",
    recurring: true,
    recurrenceLabel: "Every Monday at 6:30 PM — Rice Hall, Room 032",
  },
  {
    id: "ev-7",
    clubId: "helix",
    title: "Info Session: What We Look For",
    scope: "Public",
    date: "2026-10-01",
    time: "7:00 PM",
    location: "Rice Hall Atrium",
  },
]

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
