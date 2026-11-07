import { LEGAL_ORGANIZATION_NAME } from "@/lib/seo"

/**
 * Public Privacy and Terms text, rendered by /privacy and /terms (one source; no dialogs).
 *
 * OWNER APPROVAL REQUIRED before merge: this is a plain-language draft written from what the
 * product verifiably does today (Supabase Auth/Database/Storage, Vercel hosting and analytics,
 * transactional email, club recruiting data flows). It has not had legal review. Replace or
 * approve the wording and the contact address, then set LEGAL_LAST_UPDATED.
 */
export const CONTACT_EMAIL = "hello@out-class.net"
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}`
export const LEGAL_LAST_UPDATED = "November 7, 2026"

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] }

export const privacyPolicy: { title: string; summary: string; sections: LegalSection[] } = {
  title: "Privacy Policy",
  summary: `How ${LEGAL_ORGANIZATION_NAME} collects, uses and shares information when you use OutClass.`,
  sections: [
    { heading: "Who we are", paragraphs: [`OutClass is operated by ${LEGAL_ORGANIZATION_NAME}, a Virginia limited liability company. OutClass is independent: it is not an official University of Virginia service and is not owned, sponsored or endorsed by the university.`] },
    { heading: "Information you give us", list: [
      "Account details: your university email address and name.",
      "Your student profile: for example your major, graduation year, résumé, photo, links and any optional test scores you choose to add.",
      "Applications you start or submit to clubs, including your answers and uploaded files.",
      "Club content that club leaders publish, such as club profiles, events and announcements.",
    ] },
    { heading: "Information created when you use OutClass", list: [
      "Recruiting records that a club’s authorized reviewers create about applications to that club, such as interview times, evaluations and decisions.",
      "Meeting attendance when you check in with a club’s code.",
      "Sign-in and security records, and basic usage and performance measurements of the site.",
    ] },
    { heading: "How we use information", list: [
      "To run OutClass: your account, your profile, applications, interviews, decisions, events and club workspaces.",
      "To share an application with the club you submit it to. Only that club’s authorized members can see it.",
      "To send account emails and the recruiting and club updates that the product describes.",
      "To keep OutClass secure, prevent misuse and fix problems.",
    ] },
    { heading: "Who we share information with", paragraphs: [
      "We share application information only with the clubs you apply to. We do not sell personal information.",
      "We use service providers to operate OutClass: Supabase for sign-in, the database and file storage; Vercel for hosting and site analytics; and an email delivery provider for messages. They process information on our behalf.",
      "We may disclose information if the law requires it.",
    ] },
    { heading: "Cookies", paragraphs: ["OutClass uses cookies that are needed for sign-in and security, and one preference cookie that remembers whether the homepage shows the Students or Club Leaders view."] },
    { heading: "Your choices", paragraphs: [`You can update your profile in Settings at any time. To ask for a copy of your information or to delete your account, email ${CONTACT_EMAIL}.`] },
    { heading: "Changes", paragraphs: ["If we change this policy, we will update the date on this page. For significant changes we will tell you in OutClass or by email."] },
  ],
}

export const termsOfService: { title: string; summary: string; sections: LegalSection[] } = {
  title: "Terms of Service",
  summary: `The terms for using OutClass, operated by ${LEGAL_ORGANIZATION_NAME}.`,
  sections: [
    { heading: "Using OutClass", paragraphs: ["OutClass helps students find and apply to clubs and helps club leaders run recruiting. By creating an account or using OutClass you agree to these terms.", "You need a university email address from a participating school to create an account. Keep your sign-in details private; you are responsible for activity on your account."] },
    { heading: "Your content", paragraphs: ["You keep ownership of what you add to OutClass, such as your profile, applications and club content. You give us permission to store, display and share it as needed to run OutClass, for example sending your application to the club you applied to.", "Only add content you have the right to share, and keep it accurate."] },
    { heading: "Clubs and decisions", paragraphs: ["Each club runs its own recruiting and makes its own decisions. OutClass does not guarantee admission to any club, and club profiles are written by the clubs. Figures marked “Club-reported” come from the club."] },
    { heading: "Acceptable use", list: [
      "Don’t access accounts, applications or club workspaces you aren’t authorized to use.",
      "Don’t misuse other people’s information, including applicant information you see as a club reviewer.",
      "Don’t disrupt, scrape or attempt to break OutClass.",
    ] },
    { heading: "Independence", paragraphs: ["OutClass is not an official University of Virginia service and is not owned, sponsored or endorsed by the university."] },
    { heading: "Changes and ending use", paragraphs: ["We may update OutClass and these terms. We may suspend accounts that break these terms. You can stop using OutClass at any time."] },
    { heading: "Disclaimer", paragraphs: ["OutClass is provided as is. To the extent the law allows, we are not liable for indirect or consequential losses from using it."] },
  ],
}
