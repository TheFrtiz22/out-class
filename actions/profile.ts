"use server";

import { profileSectionSchema, storagePathSchema } from "@/lib/student-profile";

import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  computingId: z.string().min(1, "Computing ID is required"),
  major: z.string().min(1, "Major is required"),
  gradYear: z.number().int().min(2020).max(2030),
  gpa: z.number().min(0).max(4.0).optional(),
  satScore: z.number().min(400).max(1600).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  bio: z.string().optional(),
  resumeUrl: storagePathSchema.optional(),
  headshotUrl: z.string().url().optional(),
  experiences: z.array(z.object({
    title: z.string(),
    subtitle: z.string(),
    period: z.string()
  })).optional()
});

export async function getStudentProfile() {
  const { user } = await requireAuth();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { experiences: true }
  });

  return { profile };
}

export async function upsertStudentProfile(data: z.infer<typeof profileSchema>) {
  const { user } = await requireAuth();
  
  // Validate input
  const parsed = profileSchema.parse(data);
  // Identity comes from the authenticated account, never a client-supplied ID.
  parsed.computingId = user.email.split("@")[0];

  if (parsed.resumeUrl && !parsed.resumeUrl.startsWith(`${user.id}/`)) {
    throw new Error("You can only save your own resume.");
  }

  // Update or create the profile
  const profile = await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      computingId: parsed.computingId,
      major: parsed.major,
      gradYear: parsed.gradYear,
      gpa: parsed.gpa,
      satScore: parsed.satScore,
      linkedinUrl: parsed.linkedinUrl || null,
      bio: parsed.bio || null,
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
      major: parsed.major,
      gradYear: parsed.gradYear,
      gpa: parsed.gpa,
      satScore: parsed.satScore,
      linkedinUrl: parsed.linkedinUrl || null,
      bio: parsed.bio || null,
      resumeUrl: parsed.resumeUrl || null,
      headshotUrl: parsed.headshotUrl || null,
      experiences: {
        create: parsed.experiences || [],
      }
    }
  });

  revalidatePath("/student-dashboard");
  revalidatePath("/profile");

  return { success: true, profile };
}


// Section updates deliberately omit unrelated fields and relations.
// Editing education must never clear a résumé or replace experience records.
export async function updateStudentProfileSection(input: unknown) {
  const { user } = await requireAuth();
  const parsed = profileSectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Check your entries." };
  const { section, ...fields } = parsed.data;
  let data;
  if (parsed.data.section === "experience") {
    data = { experiences: { deleteMany: {}, create: parsed.data.experiences } };
  } else if (parsed.data.section === "links") {
    if (parsed.data.resumeUrl && !parsed.data.resumeUrl.startsWith(`${user.id}/`)) {
      return { error: "You can only save your own resume." };
    }
    data = { linkedinUrl: parsed.data.linkedinUrl || null, resumeUrl: parsed.data.resumeUrl || null };
  } else {
    data = fields;
  }
  try {
    const profile = await prisma.studentProfile.update({
      where: { userId: user.id },
      data: data as import("@prisma/client").Prisma.StudentProfileUpdateInput,
      include: { experiences: true },
    });
    revalidatePath("/");
    return { profile };
  } catch {
    return { error: "Your changes could not be saved. Please try again." };
  }
}
