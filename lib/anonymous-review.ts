import type { Prisma } from "@prisma/client";
export type ReviewApplication = Prisma.ApplicationGetPayload<{
  include: {
    student: {
      omit: { passwordHash: true };
      include: { studentProfile: { include: { experiences: true } } };
    };
    evaluations: true;
    answers: { include: { question: true } };
    bookings: { include: { slot: true } };
  };
}>;
/** Allowlist projection: never spread applicant/profile/free-text fields into anonymous payloads. */
export function anonymousApplication(
  app: ReviewApplication,
): ReviewApplication {
  const p = app.student.studentProfile;
  const label = app.id.replaceAll("-", "").slice(-10).toUpperCase();
  return {
    id: app.id,
    clubId: app.clubId,
    roundId: app.roundId,
    status: app.status,
    studentId: `anonymous-${app.id}`,
    submittedAt: null,
    anonymousReviewText: null,
    student: {
      id: `anonymous-${app.id}`,
      email: "",
      role: "STUDENT",
      createdAt: new Date(0),
      disabledAt: null,
      studentProfile: {
        id: `anonymous-${app.id}`,
        userId: `anonymous-${app.id}`,
        firstName: "Applicant",
        lastName: label,
        computingId: "",
        major: "",
        gradYear: p?.gradYear ?? 0,
        gpa: p?.gpa ?? null,
        satScore: p?.satScore ?? null,
        actScore: p?.actScore ?? null,
        actEnglish: p?.actEnglish ?? null,
        actMath: p?.actMath ?? null,
        actReading: p?.actReading ?? null,
        actScience: p?.actScience ?? null,
        bio: app.anonymousReviewText
          ? `Manager-reviewed anonymous content:\n${app.anonymousReviewText}`
          : "Anonymous review: unstructured text, files, contact details, and appointments are withheld to protect identity. No manager-reviewed anonymous content has been prepared yet.",
        linkedinUrl: null,
        resumeUrl: null,
        headshotUrl: null,
        experiences: [],
      },
    },
    answers: [],
    bookings: [],
    evaluations: app.evaluations.map((e) => ({
      id: e.id,
      applicationId: app.id,
      interviewerId: e.interviewerId,
      round: e.round,
      score: e.score,
      notes: null,
      createdAt: new Date(0),
    })),
  };
}

/** Defense in depth, not an automatic de-identification guarantee. A manager must review context. */
export function validateAnonymousText(
  text: string,
  identity: {
    email: string;
    studentProfile: {
      firstName: string;
      lastName: string;
      computingId: string;
    } | null;
  },
) {
  if (/@|https?:|www\.|linkedin|\b(?:\+?\d[\s().-]*){7,}\b/i.test(text))
    throw new Error(
      "Remove contact details, links, and identifying numbers from the anonymous content.",
    );
  const tokens = [
    identity.email,
    identity.studentProfile?.firstName,
    identity.studentProfile?.lastName,
    identity.studentProfile?.computingId,
  ].filter((v): v is string => !!v);
  const words = text.toLocaleLowerCase().split(/[^\p{L}\p{N}_]+/u);
  if (
    tokens.some((token) =>
      token
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .some((part) => part && words.includes(part)),
    )
  )
    throw new Error(
      "Remove applicant names and identifiers from the anonymous content.",
    );
}
