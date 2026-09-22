/** Fictional marketing data. Never reads or writes recruitment records. */
export const demoApplicants = [
  {
    name: "Emma Chen",
    initials: "EC",
    subject: "Economics · Second year",
    score: "4.8",
    offset: 0,
    advances: true,
  },
  {
    name: "Noah Williams",
    initials: "NW",
    subject: "Commerce · Second year",
    score: "4.5",
    offset: 3,
    advances: true,
  },
  {
    name: "Maya Patel",
    initials: "MP",
    subject: "Computer Science · First year",
    score: "4.7",
    offset: 6,
    advances: true,
  },
  {
    name: "Lucas Martin",
    initials: "LM",
    subject: "Public Policy · First year",
    score: "3.4",
    offset: 9,
    advances: false,
  },
  {
    name: "Sofia Rodriguez",
    initials: "SR",
    subject: "Economics · First year",
    score: "4.6",
    offset: 12,
    advances: true,
  },
  {
    name: "Ethan Kim",
    initials: "EK",
    subject: "Statistics · Second year",
    score: "3.6",
    offset: 15,
    advances: false,
  },
] as const

export const DEMO_TICKS = 40 // 20 seconds, including a resting state and a soft reset.
export const demoStages = [
  "Created",
  "In progress",
  "Submitted",
  "Review",
  "Team scoring",
  "Voting",
  "Interview",
  "Final review",
  "Accepted",
  "Not advanced",
] as const
export type DemoStage = (typeof demoStages)[number]
export function applicantStage(
  tick: number,
  applicant: (typeof demoApplicants)[number],
): DemoStage {
  const age = tick - applicant.offset
  if (age < 1) return "Created"
  if (age < 3) return "In progress"
  if (age < 4) return "Submitted"
  if (age < 5) return "Review"
  if (age < 7) return "Team scoring"
  if (age < 10) return "Voting"
  if (!applicant.advances) return "Not advanced"
  if (age < 14) return "Interview"
  if (age < 18) return "Final review"
  return "Accepted"
}
export function stageColumn(stage: DemoStage) {
  if (["Created", "In progress", "Submitted"].includes(stage)) return 0
  if (["Review", "Team scoring", "Voting"].includes(stage)) return 1
  if (["Interview", "Final review"].includes(stage)) return 2
  return 3
}
