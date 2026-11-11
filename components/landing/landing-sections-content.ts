import type { LandingPerspective } from "./journey-content"

/**
 * Homepage copy for the decision moment, "A season on Grounds" and the feature ledger, from
 * docs/public-site/redesign/Main.mockup.html. Everything shown in the illustrations is fictional sample data.
 */

export const decisionMoment = {
  leader: {
    kicker: "Live voting",
    title: "Decision night, without the whiteboard.",
    body: "Put each applicant on screen, let members vote from their phones with a QR code, and watch the count against your target. Hold the close calls and run another pass until the class is set.",
    illustration: {
      kind: "vote",
      round: "Round 3 · Applicant 7 of 18",
      status: "Live",
      applicant: { name: "Jordan Avery", detail: "Third year · Commerce · Panel average 8.0", photo: "/images/landing/jordan-avery.jpg" },
      members: 18,
      target: 12,
      tally: { pass: 11, hold: 2, notPass: 1 },
      actions: ["Pass", "Hold", "Not pass"],
    },
  },
  student: {
    kicker: "Offers",
    title: "The best message of the semester.",
    body: "When a club says yes, your offer arrives in OutClass with everything you need to respond. Accept, and you are on the roster for the first meeting.",
    illustration: {
      kind: "offer",
      club: { name: "Jefferson Investment Society", detail: "Decision · Spring 2027", logo: "/images/landing/jefferson-investment-society.png" },
      message: "Congratulations, Jordan. We’d love to have you in the analyst class.",
      deadline: "Respond by Friday 5:00 PM",
      actions: ["Accept offer", "Decline"],
    },
  },
} as const

export const recruitmentSeason = {
  kicker: "A season on Grounds",
  title: "From the activities fair to the first meeting.",
  caption: "A typical recruitment cycle",
  steps: [
    { numeral: "i", title: "Activities fair", body: "Students follow clubs instead of signing paper lists." },
    { numeral: "ii", title: "Info sessions", body: "QR check-in, with attendance kept for review." },
    { numeral: "iii", title: "Applications", body: "One profile plus each club’s own questions." },
    { numeral: "iv", title: "Interviews", body: "Panels proposed, approved, then booked." },
    { numeral: "v", title: "Decision night", body: "Live votes and offers, in the same place." },
    { numeral: "vi", title: "First meeting", body: "The new class lands on the roster." },
  ],
} as const

type SpecimenTone = "done" | "active" | "neutral" | "strong"
/** A small piece of product UI with fictional data, shown beside each feature (rendered with StatusMark). */
export type FeatureSpecimen = { label: string; sub: string; rows: readonly { name: string; meta: string; status: string; tone: SpecimenTone }[] }
export type Feature = { title: string; body: string; specimen: FeatureSpecimen }

export const featureGrid: Record<LandingPerspective, { kicker: string; title: string; features: readonly Feature[] }> = {
  leader: {
    kicker: "For club leaders",
    title: "Everything recruiting needs, and what comes after.",
    features: [
      { title: "Shared rubrics", body: "Everyone scores against the same criteria, with anonymous review when a round turns it on.", specimen: { label: "Round 1 rubric", sub: "Anonymous review on", rows: [
        { name: "Fit with the club", meta: "1 to 5 · 40% of score", status: "Shared", tone: "done" },
        { name: "Written response", meta: "1 to 5 · 35% of score", status: "Shared", tone: "done" },
        { name: "Experience", meta: "1 to 5 · 25% of score", status: "Shared", tone: "done" } ] } },
      { title: "Interview rooms and panels", body: "Collect availability, auto-fill a proposal and approve it before anyone is booked.", specimen: { label: "Panel proposal", sub: "Thursday · 6 interviews", rows: [
        { name: "Panel A · Room 204", meta: "6:30 PM · two interviewers", status: "Approved", tone: "done" },
        { name: "Panel C · Room 204", meta: "7:30 PM · one interviewer", status: "Needs one more", tone: "active" },
        { name: "Publish schedule", meta: "Owner approval required", status: "Waiting", tone: "neutral" } ] } },
      { title: "Focused interview room", body: "Question banks, private notes and the applicant’s resume side by side.", specimen: { label: "Interview · Jordan Avery", sub: "Panel A · Room 204", rows: [
        { name: "Question bank", meta: "Question 3 of 6", status: "Asking", tone: "active" },
        { name: "Private notes", meta: "Only you can see these", status: "Saved", tone: "done" },
        { name: "Resume", meta: "Open beside your notes", status: "Open", tone: "neutral" } ] } },
      { title: "Live voting", body: "Members join with a QR code and vote applicant by applicant until the class is set.", specimen: { label: "Round 3 · Applicant 7 of 18", sub: "Target: 12 passes", rows: [
        { name: "Jordan Avery", meta: "11 pass · 2 hold · 1 not pass", status: "Live", tone: "strong" },
        { name: "Members joined", meta: "14 of 18 by QR code", status: "Voting", tone: "active" } ] } },
      { title: "Meetings and attendance", body: "Agendas, QR check-in and attendance that carries into review.", specimen: { label: "General meeting", sub: "Monday 7:00 PM · Rouss Hall", rows: [
        { name: "Agenda", meta: "Four items · shared with members", status: "Ready", tone: "done" },
        { name: "QR check-in", meta: "31 of 38 members checked in", status: "Open", tone: "active" } ] } },
      { title: "Roles and access", body: "Owners, admins, interviewers and members each see what they need.", specimen: { label: "Members", sub: "38 people", rows: [
        { name: "Sofia Chen", meta: "President", status: "Owner", tone: "strong" },
        { name: "Daniel Okafor", meta: "Recruitment chair", status: "Admin", tone: "neutral" },
        { name: "Priya Nair", meta: "Analyst", status: "Interviewer", tone: "neutral" } ] } },
    ],
  },
  student: {
    kicker: "For students",
    title: "Less retyping. More time on what matters.",
    features: [
      { title: "One profile", body: "Academics, experience, headshot and resume, entered once.", specimen: { label: "Your profile", sub: "Used for every application", rows: [
        { name: "Academics and experience", meta: "Third year · Commerce", status: "Complete", tone: "done" },
        { name: "Resume", meta: "Updated Oct 20", status: "Included", tone: "done" } ] } },
      { title: "Club-specific questions", body: "Answer what each club actually asks, without separate forms.", specimen: { label: "Jefferson Investment Society", sub: "Three club questions", rows: [
        { name: "Why this club?", meta: "182 of 250 words", status: "Draft", tone: "active" },
        { name: "A market you follow", meta: "Up to 250 words", status: "Not started", tone: "neutral" } ] } },
      { title: "Book your interview", body: "Pick from the times a club offers. Your booking shows up with your application.", specimen: { label: "Choose an interview time", sub: "Jefferson Investment Society", rows: [
        { name: "Thursday 6:30 PM", meta: "Room 204 · 30 minutes", status: "Selected", tone: "strong" },
        { name: "Friday 4:00 PM", meta: "Room 204 · 30 minutes", status: "Open", tone: "neutral" } ] } },
      { title: "Status in one place", body: "See every application move from review to decision.", specimen: { label: "My applications", sub: "Spring 2027", rows: [
        { name: "Jefferson Investment Society", meta: "Interview Thursday 6:30 PM", status: "Interview", tone: "active" },
        { name: "Grounds Impact Consulting", meta: "Round 1 review", status: "In review", tone: "neutral" } ] } },
      { title: "Follow clubs", body: "Hear when clubs you care about open applications.", specimen: { label: "Following", sub: "Two clubs", rows: [
        { name: "Grounds Impact Consulting", meta: "Applications opened today", status: "Recruiting", tone: "active" },
        { name: "Jefferson Investment Society", meta: "Opens January 20", status: "Following", tone: "neutral" } ] } },
      { title: "My Clubs", body: "Meetings, tasks and announcements once you join.", specimen: { label: "My clubs", sub: "Jefferson Investment Society", rows: [
        { name: "New member meeting", meta: "Monday 7:00 PM", status: "Upcoming", tone: "active" },
        { name: "Onboarding tasks", meta: "2 of 4 done", status: "In progress", tone: "neutral" } ] } },
    ],
  },
}
