import type { LandingPerspective } from "./journey-content"

/**
 * Homepage copy for the decision moment, "A season on Grounds" and the feature grid, from
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

export const featureGrid: Record<LandingPerspective, { kicker: string; title: string; features: readonly { title: string; body: string }[] }> = {
  leader: {
    kicker: "For club leaders",
    title: "Everything recruiting needs, and what comes after.",
    features: [
      { title: "Shared rubrics", body: "Everyone scores against the same criteria, with anonymous review when a round turns it on." },
      { title: "Interview rooms and panels", body: "Collect availability, auto-fill a proposal and approve it before anyone is booked." },
      { title: "Focused interview room", body: "Question banks, private notes and the applicant’s resume side by side." },
      { title: "Live voting", body: "Members join with a QR code and vote applicant by applicant until the class is set." },
      { title: "Meetings and attendance", body: "Agendas, QR check-in and attendance that carries into review." },
      { title: "Roles and access", body: "Owners, admins, interviewers and members each see what they need." },
    ],
  },
  student: {
    kicker: "For students",
    title: "Less retyping. More time on what matters.",
    features: [
      { title: "One profile", body: "Academics, experience, headshot and resume, entered once." },
      { title: "Club-specific questions", body: "Answer what each club actually asks, without separate forms." },
      { title: "Book your interview", body: "Pick from the times a club offers. Your booking shows up with your application." },
      { title: "Status in one place", body: "See every application move from review to decision." },
      { title: "Follow clubs", body: "Hear when clubs you care about open applications." },
      { title: "My Clubs", body: "Meetings, tasks and announcements once you join." },
    ],
  },
}
