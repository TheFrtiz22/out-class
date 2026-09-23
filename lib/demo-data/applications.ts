/**
 * Demo application distribution — assigns the 100 demo students across
 * all 20 demo clubs with varied stages, scores, and realistic distributions.
 * Deterministic (index-based) so results are stable across reloads.
 */

import type {
  TrackedApplication,
  TrackerStatus,
  Applicant,
  EssayPrompt,
  DecisionRecord,
  StudentMembership,
  ExperienceItem,
} from "@/lib/data"
import { demoApplicants } from "./students"
import { demoClubs, demoDiscoverClubs } from "./clubs"

// ── Stages each club's applicants are distributed across ──

const LEADER_STAGES = ["Applied", "Round 1", "Round 2", "Accepted", "Rejected"] as const

const TRACKER_STATUSES: TrackerStatus[] = [
  "Drafting", "Submitted", "In Review", "Interviewing",
  "1st Round Interview", "Decision Pending", "Accepted", "Rejected", "Waitlisted",
]

// ── Build club→applicant assignments ──
// Each student applies to 2–6 clubs (deterministic based on index).
// This produces ~350 total applications.

type ClubAssignment = {
  studentIndex: number
  clubIndex: number
  stage: string
  score: number
  interviewScores: { round: string; score: number; maxScore: number }[]
}

const assignments: ClubAssignment[] = []

for (let s = 0; s < 100; s++) {
  // Number of clubs this student applies to: 2-6
  const numClubs = 2 + (((s * 7) + 3) % 5)
  for (let c = 0; c < numClubs; c++) {
    const clubIndex = ((s * 3) + (c * 13) + 5) % 20
    // Avoid duplicate club assignments for the same student
    if (assignments.some(a => a.studentIndex === s && a.clubIndex === clubIndex)) continue

    // Distribute across stages — vary by club to avoid identical dashboards
    const stagePool = LEADER_STAGES
    const stageIndex = ((s * 11) + (c * 7) + clubIndex) % stagePool.length
    const stage = stagePool[stageIndex]

    // Score: 0-5 range, weighted toward middle
    const score = Number((1.5 + (((s * 13) + (c * 17)) % 35) / 10).toFixed(1))

    // Interview scores for students past Round 1
    const interviewScores: { round: string; score: number; maxScore: number }[] = []
    if (stage === "Round 1" || stage === "Round 2" || stage === "Accepted") {
      interviewScores.push({
        round: "Round 1",
        score: 2 + (((s * 3) + c) % 4),
        maxScore: 5,
      })
    }
    if (stage === "Round 2" || stage === "Accepted") {
      interviewScores.push({
        round: "Round 2",
        score: 3 + (((s * 5) + c) % 3),
        maxScore: 5,
      })
    }

    assignments.push({ studentIndex: s, clubIndex, stage, score, interviewScores })
  }
}

// ── Derive per-club applicant lists (for leader dashboard) ──

/**
 * Returns the demo applicants for a specific club with statuses and scores populated.
 * Used by the leader dashboard / CRM table.
 */
export function getDemoClubApplicants(clubId: string): Applicant[] {
  const clubIndex = demoClubs.findIndex(c => c.id === clubId)
  if (clubIndex === -1) return []

  return assignments
    .filter(a => a.clubIndex === clubIndex)
    .map(a => {
      const student = demoApplicants[a.studentIndex]
      return {
        ...student,
        status: a.stage,
        score: a.score,
        interviewScores: a.interviewScores,
      }
    })
}

/**
 * The full applicant list used by the global `applicants` export in lib/data.ts.
 * Merges all assignments, keeping each student's first assignment as their status.
 */
export const demoMergedApplicants: Applicant[] = demoApplicants.map((student, s) => {
  const first = assignments.find(a => a.studentIndex === s)
  if (!first) return student
  return {
    ...student,
    status: first.stage,
    score: first.score,
    interviewScores: first.interviewScores,
  }
})

// ── Student-facing tracked applications ──

export const demoTrackedApplications: TrackedApplication[] = (() => {
  // For the demo student view, show applications for the first student
  // across 4-5 clubs with varied statuses
  const studentApps = assignments.filter(a => a.studentIndex === 0)
  return studentApps.map((a, i) => {
    const club = demoClubs[a.clubIndex]
    const disc = demoDiscoverClubs[a.clubIndex]
    const status = TRACKER_STATUSES[((a.clubIndex * 3) + i) % TRACKER_STATUSES.length]
    return {
      id: `trk-demo-${a.clubIndex}-${i}`,
      clubId: club.id,
      clubName: club.name,
      logoUrl: null,
      logoText: disc?.logoText ?? club.name.slice(0, 3).toUpperCase(),
      color: club.color,
      status,
      questionsCompleted: status === "Drafting" ? 1 : 3,
      questionsTotal: 3,
      nextDeadline: status === "Drafting" ? "Complete by Friday" : "Under review",
      dueInHours: status === "Drafting" ? 72 : 0,
    }
  })
})()

// ── Essay prompts for the student application form ──

export const demoEssayPrompts: EssayPrompt[] = demoTrackedApplications.slice(0, 3).flatMap((app, i) => [
  {
    id: `ep-${i}-1`,
    clubId: app.clubId,
    clubName: app.clubName,
    logoUrl: null,
    logoText: app.logoText,
    color: app.color,
    promptGroup: "Application Essays",
    question: "Why are you interested in joining this organization?",
    answer: i === 0 ? "I'm drawn to the rigorous, collaborative environment and the chance to apply classroom knowledge to real-world challenges." : "",
    wordLimit: 300,
  },
  {
    id: `ep-${i}-2`,
    clubId: app.clubId,
    clubName: app.clubName,
    logoUrl: null,
    logoText: app.logoText,
    color: app.color,
    promptGroup: "Application Essays",
    question: "Describe a time you demonstrated leadership.",
    answer: "",
    wordLimit: 250,
  },
])

// ── Decision history for the student ──

export const demoDecisionHistory: DecisionRecord[] = [
  {
    id: "dec-1",
    clubName: demoClubs[2].name,
    logoUrl: null,
    logoText: demoDiscoverClubs[2].logoText,
    color: demoClubs[2].color,
    cycle: "Fall 2026",
    outcome: "Accepted",
    decisionDate: "Sep 15, 2026",
    feedback: "Congratulations! We were impressed by your application and interview performance.",
  },
  {
    id: "dec-2",
    clubName: demoClubs[5].name,
    logoUrl: null,
    logoText: demoDiscoverClubs[5].logoText,
    color: demoClubs[5].color,
    cycle: "Fall 2026",
    outcome: "Waitlisted",
    decisionDate: "Sep 14, 2026",
    feedback: "You've been placed on our waitlist. We'll notify you if a spot opens.",
  },
  {
    id: "dec-3",
    clubName: demoClubs[8].name,
    logoUrl: null,
    logoText: demoDiscoverClubs[8].logoText,
    color: demoClubs[8].color,
    cycle: "Fall 2026",
    outcome: "Rejected",
    decisionDate: "Sep 12, 2026",
    feedback: "Thank you for your interest. We encourage you to reapply next semester.",
  },
]

// ── Student memberships ──

export const demoStudentMemberships: StudentMembership[] = [
  {
    clubId: demoClubs[0].id,
    clubName: demoClubs[0].name,
    logoUrl: null,
    logoText: demoDiscoverClubs[0].logoText,
    color: demoClubs[0].color,
    role: "Member",
  },
  {
    clubId: demoClubs[3].id,
    clubName: demoClubs[3].name,
    logoUrl: null,
    logoText: demoDiscoverClubs[3].logoText,
    color: demoClubs[3].color,
    role: "Executive",
    title: "VP of Recruitment",
  },
]

// ── Student experience items ──

export const demoExperienceItems: ExperienceItem[] = [
  { id: "exp-1", title: "Summer Analyst", subtitle: "SAMPLE Investment Bank", period: "Jun 2026 — Aug 2026" },
  { id: "exp-2", title: "Research Assistant", subtitle: "UVA Department of Economics", period: "Jan 2026 — May 2026" },
  { id: "exp-3", title: "VP of Finance", subtitle: "Student Council", period: "Sep 2025 — Present" },
  { id: "exp-4", title: "Peer Tutor", subtitle: "UVA Learning Center", period: "Sep 2025 — Dec 2025" },
]

// ── Per-club applicant counts for the discover view ──

export function getDemoClubApplicantCount(clubId: string): number {
  const clubIndex = demoClubs.findIndex(c => c.id === clubId)
  if (clubIndex === -1) return 0
  return assignments.filter(a => a.clubIndex === clubIndex).length
}

// ── Summary: how many applicants per stage for a club ──

export function getDemoClubStageCounts(clubId: string): Record<string, number> {
  const clubIndex = demoClubs.findIndex(c => c.id === clubId)
  if (clubIndex === -1) return {}
  const counts: Record<string, number> = {}
  for (const a of assignments) {
    if (a.clubIndex !== clubIndex) continue
    counts[a.stage] = (counts[a.stage] || 0) + 1
  }
  return counts
}

