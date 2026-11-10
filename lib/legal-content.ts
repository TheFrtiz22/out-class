import { LEGAL_ORGANIZATION_NAME } from "@/lib/seo"

/**
 * Privacy Policy and Terms of Service for /privacy and /terms (one source; no dialogs).
 *
 * NOT PUBLIC YET (owner decision 2026-11-07). While LEGAL_PAGES_PUBLIC is false, /privacy and /terms
 * return 404, are absent from the sitemap and the footer shows no Legal column. Before turning it
 * on: have counsel review this text, confirm CONTACT_EMAIL and the mailing address, and set
 * LEGAL_EFFECTIVE_DATE to the publication date.
 *
 * The text describes what the product does today (Supabase Auth, Database and Storage; Vercel
 * hosting, analytics and performance measurement; transactional email; club recruiting data flows).
 * Update it whenever those facts change.
 */
export const LEGAL_PAGES_PUBLIC = false
export const CONTACT_EMAIL = "hello@out-class.net"
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}`
export const LEGAL_EFFECTIVE_DATE = "[effective date]"
const COMPANY = LEGAL_ORGANIZATION_NAME
const SERVICE = "OutClass"

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] }
export type LegalDocument = { title: string; summary: string; sections: LegalSection[] }

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  summary: `This Privacy Policy explains how ${COMPANY} collects, uses, discloses and protects personal information in connection with ${SERVICE}.`,
  sections: [
    { heading: "1. Who we are and scope", paragraphs: [
      `${SERVICE} is operated by ${COMPANY}, a Virginia limited liability company ("${SERVICE}", "we", "us" or "our"). This Privacy Policy applies to personal information we process when you visit our websites, create an account, or use the ${SERVICE} platform and related services (together, the "Services").`,
      `${SERVICE} is independent. It is not an official service of the University of Virginia or any other institution and is not owned, sponsored or endorsed by any university. Student organizations ("Clubs") that use ${SERVICE} are responsible for their own recruiting decisions and for how their authorized members use information made available to them through the Services.`,
    ] },
    { heading: "2. Information we collect", paragraphs: ["We collect the following categories of personal information:"], list: [
      "Account information: your name, your university email address, sign-in credentials (passwords are stored by our authentication provider in hashed form) and, if you use it, identifiers from your university sign-in provider.",
      "Profile information you provide: for example academic details such as school, major and expected graduation year, a résumé, a photograph, links to other profiles, prior experience and, if you choose to add them, standardized test scores.",
      "Application information: answers, files and other materials you submit to a Club, and the status of your applications.",
      "Recruiting records created by Clubs: interview scheduling information, evaluations, notes, scores, votes and decisions recorded by a Club's authorized members about applications submitted to that Club.",
      "Club and membership information: Club profiles, events, announcements, tasks, meeting attendance and similar content created by Club members and leaders.",
      "Communications: messages and requests you send to us or through the Services, including school requests submitted through our website.",
      "Technical and usage information: IP address, browser and device information, pages viewed, and performance and diagnostic data collected automatically when you use the Services.",
    ] },
    { heading: "3. How we use personal information", paragraphs: ["We use personal information to:"], list: [
      "provide, operate and maintain the Services, including creating and managing your account and profile;",
      "submit your applications to the Clubs you choose and enable those Clubs to review applications, schedule interviews and record decisions;",
      "send service communications, such as sign-in codes, invitations, interview confirmations, decision notices and Club updates;",
      "secure the Services, verify identity and university affiliation, prevent fraud and misuse, and enforce our Terms of Service;",
      "measure, troubleshoot and improve the performance and reliability of the Services; and",
      "comply with legal obligations and respond to lawful requests.",
    ] },
    { heading: "4. How we disclose personal information", paragraphs: ["We do not sell personal information and we do not share it for cross-context behavioral advertising. We disclose personal information only as follows:"], list: [
      "To Clubs you apply to or join: your profile and application materials are made available to the authorized members of the Club you submit them to, and membership information is available to that Club's authorized members.",
      "To service providers that process information on our behalf under contractual obligations, including Supabase (authentication, database and file storage), Vercel (hosting, web analytics and performance measurement) and our email delivery providers.",
      "To comply with law, regulation, legal process or an enforceable governmental request, or to protect the rights, property or safety of our users, the public or us.",
      "In connection with a merger, acquisition, financing or sale of all or part of our business, subject to this Privacy Policy.",
      "With your consent or at your direction.",
    ] },
    { heading: "5. Cookies and similar technologies", paragraphs: [
      "We use cookies and similar technologies that are necessary to sign you in, keep your session secure and operate the Services, and one preference cookie that remembers whether our homepage shows the student or club leader view. We use privacy-oriented web analytics and performance measurement to understand aggregate use of the Services. We do not use advertising cookies.",
    ] },
    { heading: "6. Retention", paragraphs: [
      "We retain personal information for as long as your account is active and as needed to provide the Services. Recruiting records may be retained by the relevant Club's workspace for that Club's records. We also retain information as necessary to comply with legal obligations, resolve disputes and enforce our agreements. When information is no longer needed, we delete or de-identify it.",
    ] },
    { heading: "7. Security", paragraphs: [
      "We use administrative, technical and physical safeguards designed to protect personal information, including access controls that limit Club data to authorized members. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
    ] },
    { heading: "8. Your choices and rights", paragraphs: [
      `You can review and update your profile in your account settings. You may request access to, correction of, or deletion of your personal information by contacting us at ${CONTACT_EMAIL}. We will respond as required by applicable law. We may need to verify your identity before acting on a request. Deleting your account does not remove copies of application materials that a Club retains in its own records outside the Services.`,
    ] },
    { heading: "9. Students and education records", paragraphs: [
      `${SERVICE} is offered directly to students and student organizations and is not operated on behalf of a university. Information you provide to ${SERVICE} is governed by this Privacy Policy and is not an education record maintained by your institution.`,
    ] },
    { heading: "10. Children", paragraphs: [`The Services are intended for college and university students and are not directed to children under 13. We do not knowingly collect personal information from children under 13.`] },
    { heading: "11. Changes to this Privacy Policy", paragraphs: [`We may update this Privacy Policy from time to time. We will post the updated version with a new effective date and, where the changes are material, notify you through the Services or by email.`] },
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
      "You must be a current student or authorized member of a participating institution, use a valid university email address, and be at least 13 years old (and old enough to form a binding contract where you live). You must provide accurate information and keep it current.",
      "You are responsible for safeguarding your sign-in credentials and for all activity under your account. Notify us promptly of any unauthorized use.",
    ] },
    { heading: "3. Clubs and recruiting", paragraphs: [
      "Student organizations (\"Clubs\") use the Services to publish profiles, accept applications, schedule interviews, evaluate applicants and manage members. Each Club independently determines its own recruiting criteria, process and decisions. We do not guarantee admission to any Club, the accuracy of any Club's content, or any outcome of a recruiting process. Statistics marked \"Club-reported\" are provided by the Club.",
      "Club leaders and members who access applicant information may use it only for their Club's recruiting and membership purposes, must keep it confidential, and must comply with these Terms, applicable law and their institution's policies.",
    ] },
    { heading: "4. Your content", paragraphs: [
      "You retain ownership of the content you submit to the Services, such as your profile, applications and Club content (\"Your Content\"). You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display and transmit Your Content solely to operate, secure and improve the Services, including sharing your applications with the Clubs you choose.",
      "You represent that you have the rights necessary to submit Your Content and that it is accurate and does not violate any law or the rights of others.",
    ] },
    { heading: "5. Acceptable use", paragraphs: ["You agree not to:"], list: [
      "access or attempt to access accounts, applications, Club workspaces or data you are not authorized to access;",
      "misuse, disclose or retain applicant or member information beyond your Club's legitimate purposes;",
      "submit false, misleading, infringing, harassing, discriminatory or unlawful content;",
      "interfere with or disrupt the Services, circumvent security or access controls, or introduce malicious code;",
      "scrape, crawl or harvest data from the Services by automated means, or reverse engineer the Services except as permitted by law; or",
      "use the Services in violation of any applicable law or your institution's policies.",
    ] },
    { heading: "6. Our intellectual property", paragraphs: [`The Services, including software, design, text and graphics (excluding Your Content and Club content), are owned by ${COMPANY} or its licensors and are protected by intellectual property laws. We grant you a limited, revocable, non-transferable license to use the Services in accordance with these Terms. ${SERVICE} names and logos may not be used without our prior written permission.`] },
    { heading: "7. Independence", paragraphs: [`${SERVICE} is not an official service of the University of Virginia or any other institution and is not owned, sponsored or endorsed by any university.`] },
    { heading: "8. Suspension and termination", paragraphs: ["You may stop using the Services at any time. We may suspend or terminate your access, or a Club's workspace, if we reasonably believe you have violated these Terms, to protect users or the Services, or as required by law. Sections that by their nature should survive termination will survive."] },
    { heading: "9. Disclaimers", paragraphs: [`THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE OR ERROR-FREE.`] },
    { heading: "10. Limitation of liability", paragraphs: [`TO THE FULLEST EXTENT PERMITTED BY LAW, ${COMPANY.toUpperCase()} WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, OPPORTUNITY OR GOODWILL, ARISING FROM OR RELATED TO THE SERVICES OR ANY CLUB'S DECISIONS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICES WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US $100).`] },
    { heading: "11. Indemnification", paragraphs: [`You agree to indemnify and hold harmless ${COMPANY} from claims, losses and expenses (including reasonable attorneys' fees) arising from Your Content, your misuse of the Services or your violation of these Terms.`] },
    { heading: "12. Governing law", paragraphs: ["These Terms are governed by the laws of the Commonwealth of Virginia, without regard to its conflict-of-laws rules. Any dispute arising from these Terms or the Services will be brought exclusively in the state or federal courts located in Virginia, and you consent to their jurisdiction."] },
    { heading: "13. Changes to these Terms", paragraphs: ["We may modify these Terms. We will post the updated Terms with a new effective date and, where changes are material, notify you through the Services or by email. Continued use after the effective date constitutes acceptance."] },
    { heading: "14. General", paragraphs: ["These Terms and the Privacy Policy are the entire agreement between you and us regarding the Services. If any provision is unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition or sale of assets."] },
  ],
}
