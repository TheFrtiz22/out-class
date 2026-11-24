"use server";
import { directoryMarketing, readMarketing } from "@/lib/club-marketing";
import { presentPublicMarketing } from "@/lib/public-club-content";
import { assertClubOperational } from "@/lib/club-suspension";
import { publicMeetingVisibility } from "@/lib/campus-events";

import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { applicationAvailability } from "@/lib/club-settings";
import { prisma } from "@/utils/prisma";
import type { DirectoryClub } from "@/lib/club-directory";
import { resolveViewerSchool } from "@/utils/school-scope";

// Explicit public fields only: no applicants, emails, memberships, or evaluations.
const publicFields = {
  suspendedAt: true,
  applicationOpen: true,
  applicationDeadline: true,
  marketing: true,
  testRequirement: true,
  claimedAt: true,
  campusKey: true,
  directorySource: true,
  id: true,
  name: true,
  tagline: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  category: true,
  color: true,
  acceptanceRate: true,
  aumValue: true,
  pipelineRounds: {
    where: { archivedAt: null },
    select: { id: true, name: true, order: true },
    orderBy: { order: "asc" as const },
  },
  questions: {
    where: { required: true, archivedAt: null },
    select: { prompt: true },
  },
  events: {
    where: { ...publicMeetingVisibility, date: { gte: new Date() } },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      description: true,
    },
    orderBy: { date: "asc" as const },
  },
} as const;
function publicClubSelection() {
  return {
    ...publicFields,
    events: {
      ...publicFields.events,
      where: { ...publicMeetingVisibility, date: { gte: new Date() } },
    },
  };
}
type PublicClubRecord = Prisma.ClubGetPayload<{ select: typeof publicFields }>;
function present(club: PublicClubRecord): DirectoryClub {
  return {
    marketing: club.marketing,
    testRequirement: club.testRequirement,
    claimed: !!club.claimedAt,
    campusKey: club.campusKey,
    directorySource: club.directorySource,
    id: club.id,
    name: club.name,
    logoText: club.name
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 3)
      .join(""),
    logoUrl: club.logoUrl,
    bannerUrl: club.bannerUrl,
    color: club.color,
    category: club.category,
    pitch: club.tagline,
    description: club.description,
    tags: [],
    acceptanceRate:
      (club.marketing as { showAcceptance?: boolean } | null)
        ?.showAcceptance === false
        ? null
        : club.acceptanceRate,
    aumValue:
      (club.marketing as { showAum?: boolean } | null)?.showAum === false
        ? null
        : club.aumValue,
    timeCommitment: null,
    source: "database",
    applicationAvailable:
      !club.suspendedAt && club.pipelineRounds.length > 0 && applicationAvailability(club),
    // Next's public metadata cache JSON-serializes Prisma dates.
    applicationDeadline: club.applicationDeadline ? new Date(club.applicationDeadline).toISOString() : null,
    rounds: club.pipelineRounds,
    requirements: club.questions.map((question) => question.prompt),
    publicEvents: club.events.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    })),
  };
}
// The school id is an argument, so it is part of the cache key: one school's list is never served to another.
const readClubs = unstable_cache(
  async (schoolId: string) =>
    prisma.club.findMany({
      where: { schoolId, isDiscoverable: true, suspendedAt: null },
      select: { ...publicFields, events: false },
      orderBy: { name: "asc" },
    }),
  ["public-club-directory"],
  { revalidate: 60, tags: ["club-directory"] },
);
export async function getClubDirectory(): Promise<{
  clubs: DirectoryClub[];
  error?: string;
}> {
  try {
    const school = await resolveViewerSchool();
    const clubs = await readClubs(school.id);
    // Publication withdrawal must not wait for the directory's metadata cache.
    const events = await prisma.meeting.findMany({
      where: {
        ...publicMeetingVisibility,
        clubId: { in: clubs.map((c) => c.id) },
        date: { gte: new Date() },
      },
      select: { ...publicFields.events.select, clubId: true },
      orderBy: { date: "asc" },
    });
    const eventsByClub = new Map<string, typeof events>();
    for (const event of events) {
      const group = eventsByClub.get(event.clubId);
      if (group) group.push(event);
      else eventsByClub.set(event.clubId, [event]);
    }
    // The list carries only the marketing fields cards and filters use; opening
    // a club loads its full profile through getPublicClub.
    return {
      clubs: clubs.map((club) => {
        const listed = present({ ...club, events: eventsByClub.get(club.id) ?? [] });
        return { ...listed, marketing: directoryMarketing(listed.marketing) };
      }),
    };
  } catch {
    return {
      clubs: [],
      error: "We couldn’t load the club directory. Please try again.",
    };
  }
}
export async function getPublicClub(
  id: string,
): Promise<{ club: DirectoryClub | null; error?: string }> {
  try {
    // Another school's club is not found here (its page 404s), even by direct id or slug.
    const school = await resolveViewerSchool();
    const club = await prisma.club.findFirst({
      where: { OR: [{ id }, { slug: id }], schoolId: school.id, suspendedAt: null },
      select: { ...publicFields, events: false },
    });
    if (!club) return { club: null };
    const { getPublicCorkboard } = await import("@/actions/campus-events");
    const { events } = await getPublicCorkboard({ clubId: club.id });
    // Display-only read (club page, Explore's profile view, /api/workspace "publicClub"): send the
    // public view of the marketing JSON, never research notes, source links or placeholders.
    const listed = present({ ...club, events: [] });
    return { club: { ...listed, marketing: presentPublicMarketing(readMarketing(listed.marketing)), publicEvents: events.map(({ id, title, date, endDate, allDay, location, description }) => ({ id, title, date, endDate, allDay, location, description })) } };
  } catch {
    return {
      club: null,
      error: "We couldn’t load this club. Please try again.",
    };
  }
}

/** Idempotent start: never replace answers or reset an existing application.
 * After a rejection, a new application can start in the club's next cycle; the
 * reason is returned (not thrown) because production redacts thrown messages. */
export async function startClubApplication(clubId: string): Promise<{ applicationId: string; unavailable?: never } | { applicationId: null; unavailable: string }> {
  const { requireAuth } = await import("@/utils/auth");
  const { currentApplication, reapplicationUnavailable } = await import("@/lib/recruitment-cycle");
  const { user } = await requireAuth();
  // Public clubs are the viewer's school only, as in getPublicClub: another school's club id opens nothing.
  const school = await resolveViewerSchool();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const existing = await currentApplication(tx, user.id, clubId);
    if (existing) return { applicationId: existing.id };
    // Alumni keep their application history but cannot start a new one (lib/graduation.ts).
    const { alumniRefusal } = await import("@/utils/graduation");
    const alumni = await alumniRefusal(tx, user.id, "apply");
    if (alumni) return { applicationId: null, unavailable: alumni };
    await assertClubOperational(tx, clubId);
    const club = await tx.club.findUnique({
      where: { id: clubId },
      select: { applicationOpen: true, applicationDeadline: true, schoolId: true },
    });
    if (!club || club.schoolId !== school.id) return { applicationId: null, unavailable: "Applications are not available for this club." };
    if (!applicationAvailability(club))
      return { applicationId: null, unavailable: "Applications are closed for this club." };
    const unavailable = await reapplicationUnavailable(tx, user.id, clubId);
    if (unavailable) return { applicationId: null, unavailable };
    const round = await tx.pipelineRound.findFirst({
      where: { clubId, archivedAt: null },
      orderBy: { order: "asc" },
    });
    if (!round)
      return { applicationId: null, unavailable: "Applications are not available for this club." };
    const application = await tx.application.create({
      data: {
        studentId: user.id,
        clubId,
        roundId: round.id,
        status: "DRAFTING",
      },
      select: { id: true },
    });
    return { applicationId: application.id };
  });
}

/** Personal saved items use the same public club projection as Explore. */
export async function getCorkboard() {
  const { requireAuth } = await import("@/utils/auth");
  const { user } = await requireAuth();
  const school = await resolveViewerSchool();
  const records = await prisma.corkboardClub.findMany({
    where: { userId: user.id, club: { schoolId: school.id } },
    include: { club: { select: publicClubSelection() } },
    orderBy: [{ savedAt: "desc" }, { clubId: "asc" }],
  });
  return {
    items: records.map((record) => {
      // The same trimmed marketing as the Explore list: saved cards show directory fields only.
      const club = present(record.club);
      return { club: { ...club, marketing: directoryMarketing(club.marketing) },
      savedAt: record.savedAt.toISOString() };
    }),
  };
}

/** Explicit idempotent state, rather than a toggle based on stale browser state. */
export async function setCorkboardClub(input: unknown) {
  const { corkboardInput } = await import("@/lib/corkboard");
  const data = corkboardInput.parse(input);
  const { requireAuth } = await import("@/utils/auth");
  const { user } = await requireAuth();
  // Alumni accounts are read-only (lib/graduation.ts): saved clubs are neither added nor removed.
  // ActionError ALUMNI_ACCOUNT, so the app shows the read-only message rather than a generic refusal.
  const { assertNotAlumni } = await import("@/utils/graduation");
  await assertNotAlumni(prisma, user.id, "save");
  if (!data.saved) {
    await prisma.corkboardClub.deleteMany({
      where: { userId: user.id, clubId: data.clubId },
    });
    return { saved: false, savedAt: null };
  }
  const school = await resolveViewerSchool();
  const club = await prisma.club.findFirst({
    where: { id: data.clubId, schoolId: school.id },
    select: { id: true },
  });
  if (!club) throw new Error("This club is no longer available.");
  const record = await prisma.corkboardClub.upsert({
    where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    create: { userId: user.id, clubId: data.clubId },
    update: {},
  });
  return { saved: true, savedAt: record.savedAt.toISOString() };
}
