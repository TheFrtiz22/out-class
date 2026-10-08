"use server";
import { assertClubOperational } from "@/lib/club-suspension";
import { publicMeetingVisibility } from "@/lib/campus-events";

import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { applicationAvailability } from "@/lib/club-settings";
import { prisma } from "@/utils/prisma";
import type { DirectoryClub } from "@/lib/club-directory";

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
const readClubs = unstable_cache(
  async () =>
    prisma.club.findMany({
      where: { isDiscoverable: true },
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
    const clubs = await readClubs();
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
    return {
      clubs: clubs.map((club) =>
        present({
          ...club,
          events: eventsByClub.get(club.id) ?? [],
        }),
      ),
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
    const club = await prisma.club.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: publicClubSelection(),
    });
    return { club: club ? present(club) : null };
  } catch {
    return {
      club: null,
      error: "We couldn’t load this club. Please try again.",
    };
  }
}

/** Idempotent start: never replace answers or reset an existing application. */
export async function startClubApplication(clubId: string) {
  const { requireAuth } = await import("@/utils/auth");
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    const existing = await tx.application.findUnique({
      where: { studentId_clubId: { studentId: user.id, clubId } },
      select: { id: true },
    });
    if (existing) return { applicationId: existing.id };
    await assertClubOperational(tx, clubId);
    const club = await tx.club.findUnique({
      where: { id: clubId },
      select: { applicationOpen: true, applicationDeadline: true },
    });
    if (!club || !applicationAvailability(club))
      throw new Error("Applications are closed for this club.");
    const round = await tx.pipelineRound.findFirst({
      where: { clubId, archivedAt: null },
      orderBy: { order: "asc" },
    });
    if (!round)
      throw new Error("Applications are not available for this club.");
    const application = await tx.application.upsert({
      where: { studentId_clubId: { studentId: user.id, clubId } },
      update: {},
      create: {
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
  const records = await prisma.corkboardClub.findMany({
    where: { userId: user.id },
    include: { club: { select: publicClubSelection() } },
    orderBy: [{ savedAt: "desc" }, { clubId: "asc" }],
  });
  return {
    items: records.map((record) => ({
      club: present(record.club),
      savedAt: record.savedAt.toISOString(),
    })),
  };
}

/** Explicit idempotent state, rather than a toggle based on stale browser state. */
export async function setCorkboardClub(input: unknown) {
  const { corkboardInput } = await import("@/lib/corkboard");
  const data = corkboardInput.parse(input);
  const { requireAuth } = await import("@/utils/auth");
  const { user } = await requireAuth();
  if (!data.saved) {
    await prisma.corkboardClub.deleteMany({
      where: { userId: user.id, clubId: data.clubId },
    });
    return { saved: false, savedAt: null };
  }
  const club = await prisma.club.findUnique({
    where: { id: data.clubId },
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
