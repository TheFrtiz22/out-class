import { LEGAL_ORGANIZATION_NAME } from "@/lib/seo"

/**
 * Privacy Policy, Terms of Service, Cookie Policy and the Legal (business details) page, for
 * /privacy, /terms, /cookies and /legal (one source; no dialogs).
 *
 * NOT PUBLIC YET (owner decision 2026-11-07). While LEGAL_PAGES_PUBLIC is false, all four routes
 * return 404, are absent from the sitemap and the footer shows no Legal column. Before turning it
 * on: have counsel review this text (docs/legal-review-checklist.md lists every placeholder and
 * open question), set OUTCLASS_POSTAL_ADDRESS, fill every LEGAL_PLACEHOLDERS value and set
 * LEGAL_EFFECTIVE_DATE to the publication date.
 *
 * The text describes what the product does today. Update it whenever those facts change: a new
 * processor, a new profile field, or a new cookie (tests/public-seo-legal.test.cjs scans the source
 * for cookies and fails when one is missing from SITE_COOKIES).
 */
export const LEGAL_PAGES_PUBLIC = false
export const CONTACT_EMAIL = "hello@out-class.net"
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}`
const COMPANY = LEGAL_ORGANIZATION_NAME
const SERVICE = "OutClass"

/** Every value counsel or the owner must supply. Bracketed so an unfilled one is obvious on the page. */
export const LEGAL_PLACEHOLDERS = {
  effectiveDate: "[effective date]",
  mailingAddress: "[mailing address: set OUTCLASS_POSTAL_ADDRESS]",
  dmcaAgentName: "[DMCA designated agent name]",
  dmcaAgentAddress: "[DMCA designated agent mailing address]",
  dmcaAgentPhone: "[DMCA designated agent telephone]",
  dmcaAgentEmail: "[DMCA designated agent email, e.g. copyright@out-class.net]",
  minorsClause: "[counsel: terms for users under 18, e.g. first-year students aged 17]",
  retentionPeriod: "[counsel/owner: retention period after account closure]",
  formationState: "[confirm state of organization: Virginia]",
} as const
export const LEGAL_EFFECTIVE_DATE = LEGAL_PLACEHOLDERS.effectiveDate

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] }
export type LegalDocument = { title: string; summary: string; sections: LegalSection[] }

/** Every cookie OutClass sets, by exact name or name pattern. Keep in step with the code (a test scans it). */
export type SiteCookie = { name: string; category: "Essential" | "Preference"; setBy: "Server" | "Browser"; duration: string; purpose: string; who: string }
export const SITE_COOKIES: SiteCookie[] = [
  { name: "sb-<project>-auth-token (and numbered parts .0, .1, and -code-verifier)", category: "Essential", setBy: "Server", duration: "Session, refreshed while you stay signed in", purpose: "Keeps you signed in and secures your session (set through our authentication provider, Supabase).", who: "Signed-in users" },
  { name: "oc-outlook-busy", category: "Essential", setBy: "Server", duration: "10 minutes", purpose: "Protects the Outlook calendar connection against forgery while you import busy times; deleted when the import finishes.", who: "Users who import Outlook busy times" },
  { name: "outclass-demo-session", category: "Essential", setBy: "Server", duration: "8 hours", purpose: "Marks a read-only demonstration session so it can never write real data.", who: "Approved demo users" },
  { name: "outclass-platform-view", category: "Essential", setBy: "Server", duration: "Until the support view is exited", purpose: "Marks an audited, read-only support view by OutClass staff.", who: "OutClass staff only" },
  { name: "outclass-admin-elevation", category: "Essential", setBy: "Server", duration: "Session", purpose: "Records that an OutClass administrator completed password and multi-factor verification.", who: "OutClass staff only" },
  { name: "outclass-admin-challenge", category: "Essential", setBy: "Server", duration: "5 minutes", purpose: "Holds a pending administrator verification challenge.", who: "OutClass staff only" },
  { name: "outclass-landing-audience", category: "Preference", setBy: "Browser", duration: "1 year", purpose: "Remembers whether our homepage shows the student or the club leader view.", who: "Visitors who choose a view" },
  { name: "oc-campus-notice-<id>", category: "Preference", setBy: "Browser", duration: "Until the browser closes", purpose: "Remembers that you dismissed a campus notice, so it does not reappear.", who: "Visitors who dismiss a notice" },
]
const cookieLine = (c: SiteCookie) => `${c.name} (${c.category.toLowerCase()}; ${c.duration.toLowerCase()}): ${c.purpose} Used for: ${c.who.toLowerCase()}.`

/** Service providers that process personal information for us. Verified against the code. */
const PROCESSORS = [
  "Supabase: authentication, sign-in sessions, our database and file storage (résumés, photos, flyers, club images, task submissions and application attachments).",
  "Vercel: website hosting and server logs, Vercel Web Analytics (aggregate page views, without cookies) and Vercel Speed Insights (page performance measurements).",
  "Resend: delivery of email, including sign-in codes, invitations, notifications and digests.",
  "Sentry: error reports from our servers and your browser, used to find and fix faults. We remove request bodies, cookies, headers, query strings, console output and anything you type before a report is sent, and we do not record sessions.",
  "Microsoft: if you choose Microsoft sign-in, Microsoft confirms your university account. If you choose to import Outlook busy times, Microsoft returns only the start, end and free/busy status of your calendar events for the week you select; we do not read event titles or attendees and do not store your Microsoft access token.",
  "Cloudflare: Cloudflare Turnstile checks that sign-up, sign-in, password recovery and school-request forms are used by a person rather than an automated program. Turnstile receives technical information about your browser and device.",
  "Typesense (when enabled): search of the public club directory. It receives only public club information, never applicant or profile data.",
  "GitHub: images in our emails (such as our logo) are served from GitHub, which receives your IP address and email client details when your email client loads them.",
]

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  summary: `This Privacy Policy explains how ${COMPANY} collects, uses, discloses and protects personal information in connection with ${SERVICE}.`,
  sections: [
    { heading: "1. Who we are and scope", paragraphs: [
      `${SERVICE} is operated by ${COMPANY}, a limited liability company organized in ${LEGAL_PLACEHOLDERS.formationState} ("${SERVICE}", "we", "us" or "our"). Our contact details and mailing address are on our Legal page (/legal). This Privacy Policy applies to personal information we process when you visit our websites, create an account, receive our emails, or use the ${SERVICE} platform and related services (together, the "Services").`,
      `${SERVICE} is independent. It is not an official service of the University of Virginia or any other institution and is not owned, sponsored or endorsed by any university. Student organizations ("Clubs") that use ${SERVICE} are responsible for their own recruiting decisions and for how their authorized members use information made available to them through the Services.`,
    ] },
    { heading: "2. Information we collect", paragraphs: ["We collect the following categories of personal information. Fields marked optional in the product are optional: you can leave them blank, and a blank field is never shared."], list: [
      "Account information: your name, your university email address, your university computing ID, sign-in credentials (passwords are stored by our authentication provider in hashed form) and, if you use Microsoft sign-in, the identifiers your university account provides.",
      "Profile information you provide: major, expected graduation year and, if you choose to add them, a photograph (headshot), a résumé, a LinkedIn profile link, a short bio, prior experience, high school, transfer-student status, scholar program, gender, pronouns, grade point average (GPA), SAT score and ACT composite and section scores. GPA and test scores are self-reported; we do not obtain them from your university or a testing agency.",
      "Application information: answers, files and other materials you submit to a Club, interview availability and bookings, offer responses, and the status of your applications.",
      "Recruiting records created by Clubs: interview schedules, evaluations, notes, comments on résumés, scores, votes and decisions recorded by a Club's authorized members about applications submitted to that Club.",
      "Club and membership information: memberships and roles, Club profiles, events, RSVPs and saved events, announcements, messages between you and a Club, tasks and task submissions, meeting attendance recorded by QR check-in, and participation in live voting.",
      "Calendar information: availability you enter, and if you choose to import them, the busy times from your Outlook calendar for a selected week. If you subscribe to your OutClass calendar feed, we issue a private feed link that you can reset.",
      "Communications: messages and requests you send to us or through the Services, including school requests submitted through our website, and records of the emails we send you and your email preferences.",
      "Issue reports and feedback: when you report an issue or send feedback, your message is stored with the page you were on, your browser and device type, screen size, the app version and any screenshot you choose to attach.",
      "Technical and usage information: IP address, browser and device information, pages viewed, performance measurements, error reports and security logs collected automatically when you use the Services.",
    ] },
    { heading: "3. How we use personal information", paragraphs: ["We use personal information to:"], list: [
      "provide, operate and maintain the Services, including creating and managing your account and profile;",
      "submit your applications to the Clubs you choose and enable those Clubs to review applications, schedule interviews, record evaluations and decisions and manage their members;",
      "send service communications, such as sign-in codes, invitations, interview confirmations, decision notices, Club announcements and, if you choose, daily digests;",
      "secure the Services, verify identity and university affiliation, prevent fraud, spam and misuse, and enforce our Terms of Service;",
      "measure, troubleshoot and improve the performance and reliability of the Services; and",
      "comply with legal obligations and respond to lawful requests.",
    ] },
    { heading: "4. What Clubs see", paragraphs: [
      "When you apply to or join a Club, that Club's authorized members can see the information needed to run its recruiting and membership, and nothing about your applications to other Clubs. Specifically:",
    ], list: [
      "Profile fields: your name, photo, major, academic year, GPA, SAT and ACT scores, experience, résumé and LinkedIn link, but only the fields the Club has chosen to show its reviewers and only fields you filled in. A Club may also apply minimum GPA or test-score rules it sets to applications submitted to it.",
      "Gender is shown only in rounds where the Club has explicitly turned it on. In anonymous review rounds, your name and photo are hidden from reviewers.",
      "Your application answers and files for that Club, your interview bookings, and your attendance at that Club's events and meetings.",
      "Your university email address and computing ID, in the Club's member roster and in applicant lists that its leaders export for their records.",
      "Evaluations, notes, scores and votes are visible to the Club's members according to the roles the Club assigns. They are not shown to applicants.",
    ] },
    { heading: "5. How we disclose personal information", paragraphs: ["We do not sell personal information and we do not share it for cross-context behavioral advertising. We disclose personal information only as follows:"], list: [
      "To Clubs you apply to or join, as described in section 4.",
      "To service providers that process information on our behalf under contractual obligations. They are listed in section 6.",
      "To OutClass staff who need it to support the Services; staff access to Club workspaces is read-only, verified and recorded in an audit log.",
      "To comply with law, regulation, legal process or an enforceable governmental request, or to protect the rights, property or safety of our users, the public or us.",
      "In connection with a merger, acquisition, financing or sale of all or part of our business, subject to this Privacy Policy.",
      "With your consent or at your direction.",
    ] },
    { heading: "6. Service providers", paragraphs: ["We use these service providers (processors). Each receives only what it needs to provide its service to us."], list: PROCESSORS },
    { heading: "7. Cookies, analytics and Do Not Track", paragraphs: [
      "We use cookies that are strictly necessary to sign you in, secure your session and operate the Services, and two preference cookies (the homepage view you chose and a dismissed campus notice). We also use browser storage for interface preferences and unsaved drafts. We do not use advertising or cross-site tracking cookies, and our analytics do not use cookies. Our Cookie Policy (/cookies) lists every cookie.",
      "Do Not Track: some browsers send a \"Do Not Track\" signal. There is no common standard for responding to it, so the Services do not change their behavior when they receive one. Because we do not track you across other websites or allow third parties to do so through the Services, there is no cross-site tracking for the signal to stop.",
    ] },
    { heading: "8. Retention", paragraphs: [
      `We retain personal information for as long as your account is active and as needed to provide the Services. After you close your account we delete or de-identify your personal information within ${LEGAL_PLACEHOLDERS.retentionPeriod}, except as described here. Recruiting records about applications you submitted (such as evaluations and decisions) may be retained in the relevant Club's workspace for that Club's records, and audit logs are retained to protect the security of the Services. Service providers keep logs and error reports for limited periods under their own retention schedules. We also retain information as necessary to comply with legal obligations, resolve disputes and enforce our agreements.`,
    ] },
    { heading: "9. Security", paragraphs: [
      "We use administrative, technical and physical safeguards designed to protect personal information, including access controls that limit Club data to that Club's authorized members, encryption in transit, and verified, logged staff access. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
    ] },
    { heading: "10. Your choices and rights", paragraphs: [
      "You have the following rights, which we honor for every user regardless of where you live:",
    ], list: [
      `Access: you can see your profile in the Services at any time, and you can ask us for a copy of the personal information we hold about you by emailing ${CONTACT_EMAIL}.`,
      "Correction: you can edit your profile in the Services, or ask us to correct information you cannot edit yourself.",
      `Deletion: you can ask us to delete your account and personal information by emailing ${CONTACT_EMAIL}. Deleting your account does not remove copies of application materials that a Club has exported into its own records outside the Services.`,
      `Export: you can ask for a copy of your profile and application information in a commonly used, machine-readable format by emailing ${CONTACT_EMAIL}.`,
      "Email choices: you can turn off optional email, such as Club announcements, task reminders and daily digests, in your email preferences or with the unsubscribe link in those emails. Unsubscribing does not stop email about your applications, decisions and interviews, which you can manage separately in your preferences, or emails needed to operate your account, such as sign-in codes and security notices.",
    ] },
    { heading: "11. How we handle requests", paragraphs: [
      "We may need to verify your identity before acting on a request, usually by confirming control of your university email address. We respond within the time required by applicable law, and in any case within 45 days. We will not discriminate against you for exercising your rights.",
    ] },
    { heading: "12. Your California privacy rights", paragraphs: [
      "California residents may have additional rights under California law. If the California Consumer Privacy Act (CCPA) applies to us, you have the right to know what personal information we collect, use and disclose; to delete it; to correct it; to opt out of its sale or sharing for cross-context behavioral advertising; and to limit our use of sensitive personal information. We do not sell or share personal information, and we use sensitive personal information (such as your account credentials) only to provide the Services. You will not be treated differently for exercising these rights.",
      `To make a request, email ${CONTACT_EMAIL}. You may use an authorized agent; we will ask the agent for proof of your permission and may ask you to verify your identity directly. In the past 12 months we collected the categories of personal information described in section 2 (identifiers; education and professional information you provide; characteristics you choose to provide, such as gender; internet and network activity; and account log-in credentials) from you, from Clubs and from your devices, for the purposes in section 3, and disclosed them for business purposes to the recipients in sections 4 to 6.`,
      "Under California's \"Shine the Light\" law, we do not disclose personal information to third parties for their own direct marketing purposes.",
    ] },
    { heading: "13. Students and education records", paragraphs: [
      `${SERVICE} is offered directly to students and student organizations and is not operated on behalf of a university. We do not receive records from university systems. Information you provide to ${SERVICE} is governed by this Privacy Policy and is not an education record maintained by your institution.`,
    ] },
    { heading: "14. Children", paragraphs: [`The Services are intended for college and university students and are not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has given us personal information, contact us and we will delete it.`] },
    { heading: "15. Changes and effective date", paragraphs: [`This Privacy Policy is effective as of ${LEGAL_EFFECTIVE_DATE}. We may update it from time to time. We will post the updated version with a new effective date and, where the changes are material, notify you through the Services or by email.`] },
    { heading: "16. Contact", paragraphs: [`Questions and requests about this Privacy Policy: ${CONTACT_EMAIL}, or by mail to ${COMPANY} at the address on our Legal page (/legal).`] },
  ],
}

export const termsOfService: LegalDocument = {
  title: "Terms of Service",
  summary: `These Terms of Service govern your access to and use of ${SERVICE}, operated by ${COMPANY}.`,
  sections: [
    { heading: "1. Agreement", paragraphs: [
      `These Terms of Service (the "Terms") are a binding agreement between you and ${COMPANY} ("${SERVICE}", "we", "us" or "our") governing your use of our websites, platform and related services (the "Services"). By creating an account or using the Services, you agree to these Terms and acknowledge our Privacy Policy. If you use the Services on behalf of a student organization, you represent that you are authorized to accept these Terms for it.`,
    ] },
    { heading: "2. Eligibility and accounts", paragraphs: [
      "The Services are currently available only to current students of the University of Virginia with a valid @virginia.edu email address, and to people a participating Club or OutClass invites. You must be at least 13 years old. If you are under 18 (for example, a first-year student aged 17), you may use the Services only with the involvement of a parent or legal guardian who agrees to these Terms on your behalf, " + LEGAL_PLACEHOLDERS.minorsClause + ".",
      "You must provide accurate information and keep it current. You are responsible for safeguarding your sign-in credentials and for all activity under your account. Notify us promptly of any unauthorized use.",
    ] },
    { heading: "3. Clubs and recruiting", paragraphs: [
      "Student organizations (\"Clubs\") use the Services to publish profiles, accept applications, schedule interviews, evaluate applicants and manage members. Each Club independently determines its own recruiting criteria, process and decisions. We do not guarantee admission to any Club, the accuracy of any Club's content, or any outcome of a recruiting process. Statistics marked \"Club-reported\" are provided by the Club.",
      "Club leaders and members who access applicant information may use it only for their Club's recruiting and membership purposes, must keep it confidential, and must comply with these Terms, applicable law and their institution's policies.",
    ] },
    { heading: "4. Your content", paragraphs: [
      "You retain ownership of the content you submit to the Services, such as your profile, applications, résumé, photos, flyers and Club content (\"Your Content\"). You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display and transmit Your Content solely to operate, secure and improve the Services, including sharing your applications with the Clubs you choose and displaying Club content to the audiences the Club selects.",
      "You represent that you own or have the rights necessary to submit Your Content, including the rights to any photographs, logos or artwork and the permission of any identifiable person shown, and that it is accurate and does not violate any law or the rights of others.",
    ] },
    { heading: "5. Acceptable use", paragraphs: ["You agree not to:"], list: [
      "access or attempt to access accounts, applications, Club workspaces or data you are not authorized to access, or share your account;",
      "misuse, disclose or retain applicant or member information beyond your Club's legitimate purposes;",
      "submit false, misleading, infringing, harassing, threatening, hateful, sexually explicit, discriminatory or unlawful content, or impersonate any person, Club or institution;",
      "use the Services to send spam or unsolicited promotions, or to collect other users' contact information;",
      "upload malicious code, or interfere with or disrupt the Services, circumvent security, rate limits or access controls;",
      "scrape, crawl or harvest data from the Services by automated means, or reverse engineer the Services except as permitted by law; or",
      "use the Services in violation of any applicable law or your institution's policies.",
    ] },
    { heading: "6. Reporting content", paragraphs: [
      `If you see content on ${SERVICE} that breaks these Terms, infringes your rights, or puts someone at risk, report it to ${CONTACT_EMAIL} with a link to or description of the content and why you are reporting it. We review reports promptly and may contact the Club or user involved. If you believe someone is in immediate danger, contact local emergency services first. Copyright complaints follow the process in section 8.`,
    ] },
    { heading: "7. Content removal", paragraphs: [
      "We may, without prior notice, remove or restrict access to any content, or decline to publish an event or flyer, if we reasonably believe it violates these Terms or the law, infringes someone's rights, or could harm users or the Services. Clubs may moderate content within their own workspace. Where reasonable we will tell the person who posted the content what was removed and why, and they may ask us to reconsider by writing to " + CONTACT_EMAIL + ". We are not obligated to monitor content and are not responsible for content posted by users or Clubs.",
    ] },
    { heading: "8. Copyright and DMCA notices", paragraphs: [
      "We respect intellectual property rights and respond to notices of alleged copyright infringement under the Digital Millennium Copyright Act (17 U.S.C. § 512). If you believe content on the Services infringes your copyright, send a written notice to our designated agent that includes: (a) your physical or electronic signature; (b) identification of the copyrighted work; (c) identification of the material you claim is infringing and information reasonably sufficient for us to locate it, such as a link; (d) your name, address, telephone number and email address; (e) a statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent or the law; and (f) a statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on its behalf.",
      `Designated agent: ${LEGAL_PLACEHOLDERS.dmcaAgentName}, ${COMPANY}, ${LEGAL_PLACEHOLDERS.dmcaAgentAddress}; telephone ${LEGAL_PLACEHOLDERS.dmcaAgentPhone}; email ${LEGAL_PLACEHOLDERS.dmcaAgentEmail}.`,
      "When we receive a valid notice we will remove or disable access to the material and notify the person who posted it. If you believe material was removed by mistake or misidentification, you may send our designated agent a counter-notice that includes your signature, identification of the removed material and its former location, a statement under penalty of perjury that you have a good-faith belief it was removed by mistake or misidentification, and your name, address and telephone number with your consent to the jurisdiction of the federal court for your district (or, if you are outside the United States, any district in which we may be found) and to accept service from the person who sent the notice. We may restore the material in 10 to 14 business days unless the complainant tells us it has filed a court action.",
      "We will terminate, in appropriate circumstances, the accounts of users who are repeat infringers. Sending a knowingly false notice or counter-notice may make you liable for damages.",
    ] },
    { heading: "9. Our intellectual property", paragraphs: [`The Services, including software, design, text and graphics (excluding Your Content and Club content), are owned by ${COMPANY} or its licensors and are protected by intellectual property laws. We grant you a limited, revocable, non-transferable license to use the Services in accordance with these Terms. ${SERVICE} names and logos may not be used without our prior written permission.`] },
    { heading: "10. Independence", paragraphs: [`${SERVICE} is not an official service of the University of Virginia or any other institution and is not owned, sponsored or endorsed by any university. University names are used only to identify the campus communities the Services support.`] },
    { heading: "11. Suspension and termination", paragraphs: ["You may stop using the Services at any time and may ask us to delete your account. We may suspend or terminate your access, or a Club's workspace, if we reasonably believe you have violated these Terms, to protect users or the Services, or as required by law. Sections that by their nature should survive termination will survive."] },
    { heading: "12. Disclaimers", paragraphs: [`THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE OR ERROR-FREE.`] },
    { heading: "13. Limitation of liability", paragraphs: [`TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, OPPORTUNITY OR GOODWILL, ARISING FROM OR RELATED TO THE SERVICES OR ANY CLUB'S DECISIONS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICES WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US $100).`] },
    { heading: "14. Indemnification", paragraphs: [`You agree to indemnify and hold harmless ${COMPANY} from claims, losses and expenses (including reasonable attorneys' fees) arising from Your Content, your misuse of the Services or your violation of these Terms.`] },
    { heading: "15. Governing law", paragraphs: ["These Terms are governed by the laws of the Commonwealth of Virginia, without regard to its conflict-of-laws rules. Any dispute arising from these Terms or the Services will be brought exclusively in the state or federal courts located in Virginia, and you consent to their jurisdiction."] },
    { heading: "16. Changes to these Terms", paragraphs: [`These Terms are effective as of ${LEGAL_EFFECTIVE_DATE}. We may modify them. We will post the updated Terms with a new effective date and, where changes are material, notify you through the Services or by email. Continued use after the effective date constitutes acceptance.`] },
    { heading: "17. General", paragraphs: ["These Terms and the Privacy Policy are the entire agreement between you and us regarding the Services. If any provision is unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition or sale of assets."] },
  ],
}

export const cookiePolicy: LegalDocument = {
  title: "Cookie Policy",
  summary: `This Cookie Policy lists every cookie ${SERVICE} sets and why. All of them are first-party; none is used for advertising or cross-site tracking.`,
  sections: [
    { heading: "1. Essential cookies", paragraphs: ["These cookies are strictly necessary to sign you in, keep the Services secure and protect sign-in flows. The Services cannot work without them, so they cannot be switched off."], list: SITE_COOKIES.filter(c => c.category === "Essential").map(cookieLine) },
    { heading: "2. Preference cookies", paragraphs: ["These cookies remember a choice you made. Blocking them only means the choice is not remembered."], list: SITE_COOKIES.filter(c => c.category === "Preference").map(cookieLine) },
    { heading: "3. Analytics and other technologies", paragraphs: [
      "Vercel Web Analytics and Vercel Speed Insights measure aggregate page views and page performance without setting cookies. Error reports sent to Sentry do not use cookies, and we do not record sessions. Cloudflare Turnstile, when it runs on a sign-in or request form, may use its own technologies to tell people from automated programs; it is used only for security.",
      "We also use your browser's local and session storage for interface preferences (such as a chosen view), unsaved drafts and sign-in flows. This information stays on your device.",
    ] },
    { heading: "4. Your choices", paragraphs: ["You can block or delete cookies in your browser settings. If you block essential cookies you will not be able to sign in. We do not respond differently to Do Not Track signals; see our Privacy Policy (/privacy)."] },
    { heading: "5. Changes", paragraphs: [`This Cookie Policy is effective as of ${LEGAL_EFFECTIVE_DATE}. We update it whenever we add or change a cookie.`] },
  ],
}

/** Business details for /legal. The address comes from OUTCLASS_POSTAL_ADDRESS (server only). */
export function legalDetails(postalAddress: string | null | undefined): LegalDocument {
  const address = postalAddress?.trim() || LEGAL_PLACEHOLDERS.mailingAddress
  return {
    title: "Legal",
    summary: `Business details for ${SERVICE} and links to our policies.`,
    sections: [
      { heading: "Operator", list: [
        `${SERVICE} is operated by ${COMPANY}, a limited liability company organized in ${LEGAL_PLACEHOLDERS.formationState}.`,
        `Mailing address: ${address}`,
        `Email: ${CONTACT_EMAIL}`,
      ] },
      { heading: "Policies", list: ["Privacy Policy: /privacy", "Terms of Service: /terms", "Cookie Policy: /cookies"] },
      { heading: "Reporting content", paragraphs: [`To report content that breaks our Terms, email ${CONTACT_EMAIL} (Terms section 6).`] },
      { heading: "Copyright agent", paragraphs: [`DMCA notices: ${LEGAL_PLACEHOLDERS.dmcaAgentName}, ${LEGAL_PLACEHOLDERS.dmcaAgentAddress}; ${LEGAL_PLACEHOLDERS.dmcaAgentEmail} (Terms section 8).`] },
      { heading: "Independence", paragraphs: [`${SERVICE} is not an official service of the University of Virginia or any other institution and is not owned, sponsored or endorsed by any university.`] },
    ],
  }
}
