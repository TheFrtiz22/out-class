"use server";
import { Prisma } from "@prisma/client";
import { scholarStatusSchema } from "@/lib/scholar-status";


import { actShape } from "@/lib/test-scores";
import { graduationYearSchemaFor } from "@/lib/graduation-years";
import { profileSectionSnapshot, gpaSchema, profileEducationFields, resumeReferenceSchema, linkedinUrlSchema, headshotUrlSchema, isPrivateResume, profileSectionSchema, profileSectionSchemaFor } from "@/lib/student-profile";

import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { TERMS_ACCEPTANCE_REQUIRED, TERMS_REQUIRED_MESSAGE } from "@/lib/legal-versions";
import { hasCurrentTermsAcceptance } from "@/utils/terms-acceptance";
import { applyGraduationYearChange, SUPPORT_YEAR_CHANGE_MESSAGE } from "@/utils/graduation";
import { actionResult } from "@/lib/action-result";
import { z } from "zod";
import { phoneSchema } from "@/lib/phone";
import { revalidatePath } from "next/cache";
import { boundedParse, boundedSafeParse } from "@/lib/bounded-input";

const profileSchemaFor = (storedGradYear?: number | null) => z.object({
  ...profileEducationFields,
  scholarStatus: scholarStatusSchema.optional(),
  ...actShape,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  computingId: z.string().min(1, "Computing ID is required"),
  major: z.string().min(1, "Major is required"),
  gradYear: graduationYearSchemaFor(storedGradYear),
  gpa: gpaSchema.optional(),
  satScore: z.number().int().min(400).max(1600).optional(),
  linkedinUrl: linkedinUrlSchema.optional().or(z.literal("")),
  phone: phoneSchema,
  resumeUrl: resumeReferenceSchema.optional(),
  headshotUrl: headshotUrlSchema.optional(),
  experiences: z.array(z.object({
    title: z.string(),
    subtitle: z.string(),
    period: z.string()
  })).optional()
});
const profileSchema = profileSchemaFor();

// The strict range applies first. Only when that fails is the stored year read, so an existing
// profile (e.g. alumni) may keep the graduation year already on file; new profiles stay strict.
async function storedGradYear(userId: string) {
  return (await prisma.studentProfile.findUnique({ where: { userId }, select: { gradYear: true } }))?.gradYear ?? null;
}

export async function getStudentProfile() {
  const { user } = await requireAuth();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { experiences: true }
  });

  return { profile };
}

// Returns through actionResult so a support-session refusal of a graduation-year change
// (utils/graduation.ts) reaches the screen; other failures still reject.
export async function upsertStudentProfile(data: z.infer<typeof profileSchema>) {
  return actionResult(() => upsertStudentProfileCommand(data), "upsertStudentProfile");
}

async function upsertStudentProfileCommand(data: z.infer<typeof profileSchema>) {
  const { user, impersonation } = await requireAuth();
  
  // Validate input
  const strict = boundedSafeParse(profileSchema, data);
  const parsed = strict.success ? strict.data : boundedParse(profileSchemaFor(await storedGradYear(user.id)), data);
  // Identity comes from the authenticated account, never a client-supplied ID.
  parsed.computingId = user.email.split("@")[0];

  if (parsed.resumeUrl && isPrivateResume(parsed.resumeUrl) && !parsed.resumeUrl.startsWith(`${user.id}/`)) {
    throw new Error("You can only save your own resume.");
  }

  if (parsed.headshotUrl && !parsed.headshotUrl.startsWith(`${user.id}/`)) throw new Error("You can only save your own photo.");

  // Creating a profile completes the account (email, Microsoft or claimed sign-ins alike): refuse
  // it until the account holder has accepted the current Terms. A support session cannot accept.
  if (TERMS_ACCEPTANCE_REQUIRED && !await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) && !await hasCurrentTermsAcceptance(prisma, user.id)) {
    throw new Error(TERMS_REQUIRED_MESSAGE);
  }

  // Update or create the profile. A changed graduation year resets the graduation answer in the
  // same transaction (utils/graduation.ts).
  const profile = await prisma.$transaction(async tx => {
  await applyGraduationYearChange(tx, user.id, parsed.gradYear, { supportSession: !!impersonation });
  return tx.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      computingId: parsed.computingId,
      highSchool: parsed.highSchool, gender: parsed.gender, pronouns: parsed.pronouns, transferStudent: parsed.transferStudent,
      major: parsed.major,
      gradYear: parsed.gradYear,
      scholarStatus: parsed.scholarStatus === null ? Prisma.DbNull : parsed.scholarStatus,
      gpa: parsed.gpa,
      satScore: parsed.satScore,
      actScore: parsed.actScore, actEnglish: parsed.actEnglish, actMath: parsed.actMath, actReading: parsed.actReading, actScience: parsed.actScience,
      linkedinUrl: parsed.linkedinUrl || null,
      phone: parsed.phone,
      resumeUrl: parsed.resumeUrl || null,
      headshotUrl: parsed.headshotUrl || null,
      experiences: {
        deleteMany: {}, // Clear existing
        create: parsed.experiences || [],
      }
    },
    create: {
      userId: user.id,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      computingId: parsed.computingId,
      highSchool: parsed.highSchool, gender: parsed.gender, pronouns: parsed.pronouns, transferStudent: parsed.transferStudent,
      major: parsed.major,
      gradYear: parsed.gradYear,
      scholarStatus: parsed.scholarStatus === null ? Prisma.DbNull : parsed.scholarStatus,
      gpa: parsed.gpa,
      satScore: parsed.satScore,
      actScore: parsed.actScore, actEnglish: parsed.actEnglish, actMath: parsed.actMath, actReading: parsed.actReading, actScience: parsed.actScience,
      linkedinUrl: parsed.linkedinUrl || null,
      phone: parsed.phone,
      resumeUrl: parsed.resumeUrl || null,
      headshotUrl: parsed.headshotUrl || null,
      experiences: {
        create: parsed.experiences || [],
      }
    }
  });
  });

  revalidatePath("/student-dashboard");
  revalidatePath("/profile");

  return { success: true, profile };
}


// Section updates deliberately omit unrelated fields and relations.
// Editing education must never clear a résumé or replace experience records.
export async function updateStudentProfileSection(input: unknown, expected?: string) {
  const { user, impersonation } = await requireAuth();
  let parsed = boundedSafeParse(profileSectionSchema, input);
  if (!parsed.success && typeof input === "object" && input !== null && (input as { section?: unknown }).section === "education") {
    parsed = boundedSafeParse(profileSectionSchemaFor(await storedGradYear(user.id)), input);
  }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Check your entries." };
  if (parsed.data.section === "identity" && parsed.data.headshotUrl && !parsed.data.headshotUrl.startsWith(`${user.id}/`)) return { error: "You can only save your own photo." };
  const { section, ...fields } = parsed.data;
  let data;
  if (parsed.data.section === "experience") {
    data = { experiences: { deleteMany: {}, create: parsed.data.experiences } };
  } else if (parsed.data.section === "links") {
    if (parsed.data.resumeUrl && isPrivateResume(parsed.data.resumeUrl) && !parsed.data.resumeUrl.startsWith(`${user.id}/`)) {
      return { error: "You can only save your own resume." };
    }
    data = { linkedinUrl: parsed.data.linkedinUrl || null, resumeUrl: parsed.data.resumeUrl || null };
  } else {
    data = { ...fields, ...("scholarStatus" in fields && fields.scholarStatus === null ? { scholarStatus: Prisma.DbNull } : {}) };
  }
  try {
    const update = (tx: Pick<typeof prisma, "studentProfile">) => tx.studentProfile.update({ where: { userId: user.id }, data: data as Prisma.StudentProfileUpdateInput, include: { experiences: true } });
    const yearChange = section === "education" && "gradYear" in fields ? fields.gradYear : undefined;
    const profile = expected === undefined && yearChange === undefined ? await update(prisma) : await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const account = await tx.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } });
      if (!account || account.disabledAt) throw Error("Account unavailable.");
      if (expected !== undefined) {
        z.string().max(100000).parse(expected);
        const current = await tx.studentProfile.findUniqueOrThrow({ where: { userId: user.id }, include: { experiences: true } });
        const next = { ...current, ...fields };
        const actual = profileSectionSnapshot(current, section);
        if (actual !== expected && actual !== profileSectionSnapshot(next, section)) throw Error("This profile section changed in another tab. Reopen it to compare. Your text is retained.");
      }
      if (yearChange !== undefined) await applyGraduationYearChange(tx, user.id, yearChange, { supportSession: !!impersonation });
      return update(tx);
    });
    revalidatePath("/", "layout");
    return { profile };
  } catch (error) {
    return { error: error instanceof Error && (error.message.includes("changed in another tab") || error.message === SUPPORT_YEAR_CHANGE_MESSAGE) ? error.message : "Your changes could not be saved. Please try again." };
  }
}
