"use server";
import { lockOperationalClub } from "@/lib/club-suspension";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { hasPermission } from "@/lib/permissions";
import {
  eventEditorSchema,
  eventCommandSchema,
  eventReviewSchema,
  eventFiltersSchema,
  eventDateWindow,
  eventIsPublished,
  type CampusEvent,
  type ManagedCampusEvent,
  type EventFilters,
} from "@/lib/campus-events";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
const eventSelect = {
  id: true,
  clubId: true,
  title: true,
  description: true,
  date: true,
  endDate: true,
  location: true,
  isPublic: true,
  audience: true,
  revision: true,
  club: { select: { name: true, suspendedAt: true } },
  publication: true,
  _count: { select: { rsvps: true } },
} as const;
export type EventRecord = Prisma.MeetingGetPayload<{
  select: typeof eventSelect;
}>;
function present(e: EventRecord, preview = false): CampusEvent {
  const p = e.publication!;
  return {
    id: e.id,
    clubId: e.clubId,
    clubName: e.club.name,
    title: e.title,
    description: e.description || "",
    date: e.date.toISOString(),
    endDate: (e.endDate || e.date).toISOString(),
    location: e.location,
    revision: e.revision,
    category: p.category,
    contact: p.contact,
    rsvpEnabled: p.rsvpEnabled,
    rsvpRequired: p.rsvpRequired,
    capacity: p.capacity,
    rsvpDeadline: p.rsvpDeadline?.toISOString() || null,
    template: p.template,
    flyerUrl: p.flyerId
      ? `/api/event-flyers?eventId=${e.id}&revision=${e.revision}${preview ? "&preview=1" : ""}`
      : null,
    rsvpCount: e._count.rsvps,
  };
}
function managed(e: EventRecord): ManagedCampusEvent {
  return {
    ...present(e, true),
    status: e.publication!.status,
    submittedAt: e.publication!.submittedAt?.toISOString() || null,
    rejectionReason: e.publication!.rejectionReason,
  };
}
function refresh() {
  revalidatePath("/corkboard");
  revalidatePath("/");
  revalidatePath("/platform/events");
  revalidateTag("club-directory");
}
async function locked(
  tx: AppTransactionClient,
  eventId: string,
  clubId?: string,
  revision?: number,
) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${eventId} FOR UPDATE`;
  const e = await tx.meeting.findUnique({
    where: { id: eventId },
    select: eventSelect,
  });
  if (!e?.publication || (clubId && e.clubId !== clubId))
    throw Error("Event unavailable.");
  if (revision !== undefined && e.revision !== revision)
    throw Error("Event changed. Reload before continuing.");
  return e;
}
export async function getPublicCorkboard(input: EventFilters = {}) {
  const f = eventFiltersSchema.parse(input),
    range = eventDateWindow(f.period, f.date);
  const where: Prisma.MeetingWhereInput = {
    club: { is: { suspendedAt: null } },
    audience: "RECRUITMENT",
    isPublic: true,
    publication: {
      is: {
        status: "PUBLISHED",
        ...(f.category ? { category: f.category } : {}),
        ...(f.required ? { rsvpRequired: true } : {}),
      },
    },
    ...(f.clubId ? { clubId: f.clubId } : {}),
    ...(f.location
      ? { location: { contains: f.location, mode: "insensitive" } }
      : {}),
    ...(range
      ? {
          date: { lt: range.end },
          OR: [
            { endDate: { gt: range.start } },
            { endDate: null, date: { gte: range.start } },
          ],
        }
      : {
          OR: [
            { endDate: { gt: new Date() } },
            { endDate: null, date: { gte: new Date() } },
          ],
        }),
    ...(f.query
      ? {
          AND: [
            {
              OR: [
                { title: { contains: f.query, mode: "insensitive" } },
                { description: { contains: f.query, mode: "insensitive" } },
                { club: { name: { contains: f.query, mode: "insensitive" } } },
                { location: { contains: f.query, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };
  const [records, total, clubs] = await Promise.all([
    prisma.meeting.findMany({
      where,
      select: eventSelect,
      orderBy:
        f.sort === "name"
          ? [{ title: "asc" }, { id: "asc" }]
          : [{ date: f.sort === "latest" ? "desc" : "asc" }, { id: "asc" }],
      take: 60,
      skip: f.page * 60,
    }),
    prisma.meeting.count({ where }),
    prisma.club.findMany({
      where: {
        suspendedAt: null,
        events: {
          some: {
            isPublic: true,
            audience: "RECRUITMENT",
            publication: { is: { status: "PUBLISHED" } },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    events: records.filter(eventIsPublished).map((e) => present(e)),
    total,
    hasMore: (f.page + 1) * 60 < total,
    clubs,
  };
}
export async function getPublicCampusEvent(eventId: string) {
  z.string().uuid().parse(eventId);
  const e = await prisma.meeting.findUnique({
    where: { id: eventId },
    select: eventSelect,
  });
  return e && eventIsPublished(e) ? present(e) : null;
}
export async function listClubCampusEvents(clubId: string) {
  z.string().uuid().parse(clubId);
  await requireClubPermission(clubId, ["meetings.manage"]);
  return (
    await prisma.meeting.findMany({
      where: { clubId, publication: { isNot: null } },
      select: eventSelect,
      orderBy: { date: "desc" },
    })
  ).map(managed);
}
export async function saveCampusEvent(input: unknown) {
  const d = eventEditorSchema.parse(input),
    { user } = await requireClubPermission(d.clubId, ["meetings.manage"]);
  const result = await prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, d.clubId);
    let id = d.id;
    const content = {
      title: d.title,
      description: d.description,
      date: d.date,
      endDate: d.endDate,
      location: d.location,
      audience: "RECRUITMENT",
      isPublic: true,
    };
    if (id) {
      const e = await locked(tx, id, d.clubId, d.revision);
      if (["CANCELLED", "ARCHIVED"].includes(e.publication!.status))
        throw Error(
          "Create a new event instead of editing a cancelled or archived event.",
        );
      if (d.capacity !== null && d.capacity < e._count.rsvps)
        throw Error("Capacity cannot be lower than existing RSVPs.");
      await tx.meeting.update({
        where: { id },
        data: { ...content, revision: { increment: 1 } },
      });
      await tx.meetingCheckInToken.deleteMany({ where: { meetingId: id } });
    } else {
      const e = await tx.meeting.create({
        data: { clubId: d.clubId, ...content },
        select: { id: true },
      });
      id = e.id;
    }
    const fields = {
      category: d.category,
      contact: d.contact,
      rsvpEnabled: d.rsvpEnabled,
      rsvpRequired: d.rsvpRequired,
      capacity: d.capacity,
      rsvpDeadline: d.rsvpDeadline,
      template: d.template,
      status: "DRAFT",
      approvedRevision: null,
      publishedAt: null,
      ...(d.useTemplate ? { flyerId: null } : {}),
    };
    await tx.eventPublication.upsert({
      where: { eventId: id },
      create: { eventId: id, ...fields },
      update: fields,
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "event.draft.save",
        targetId: id,
        clubId: d.clubId,
      },
    });
    return managed(
      (await tx.meeting.findUnique({ where: { id }, select: eventSelect }))!,
    );
  });
  refresh();
  return result;
}
export async function commandCampusEvent(input: unknown) {
  const d = eventCommandSchema.parse(input),
    { user } = await requireClubPermission(d.clubId, ["meetings.manage"]);
  const result = await prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, d.clubId);
    const e = await locked(tx, d.eventId, d.clubId, d.revision),
      p = e.publication!;
    if (d.command === "SUBMIT") {
      if (!["DRAFT", "REJECTED"].includes(p.status))
        throw Error("Only draft or rejected events can be submitted.");
      if (e.date <= new Date())
        throw Error("Choose a future event start before submitting.");
      // The template is a complete flyer without an upload. Structured fields are canonical.
      if (!e.description?.trim() || !e.endDate)
        throw Error("Complete the event details before submitting.");
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "event.submitted",
          targetId: e.id,
          clubId: e.clubId,
          details: { revision: e.revision },
        },
      });
    } else if (["CANCELLED", "ARCHIVED"].includes(p.status))
      throw Error("This event is already closed.");
    const status =
      d.command === "SUBMIT"
        ? "PENDING"
        : d.command === "WITHDRAW"
          ? "DRAFT"
          : d.command === "CANCEL"
            ? "CANCELLED"
            : "ARCHIVED";
    await tx.eventPublication.update({
      where: { eventId: e.id },
      data: {
        status,
        approvedRevision: null,
        publishedAt: null,
        ...(d.command === "SUBMIT"
          ? {
              submittedAt: new Date(),
              submittedBy: user.id,
              reviewedAt: null,
              reviewedBy: null,
              rejectionReason: null,
            }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `event.${status.toLowerCase()}`,
        targetId: e.id,
        clubId: e.clubId,
        details: { revision: e.revision },
      },
    });
    return managed(
      (await tx.meeting.findUnique({
        where: { id: e.id },
        select: eventSelect,
      }))!,
    );
  });
  refresh();
  return result;
}
export async function listEventApprovals(status = "PENDING") {
  const actor = await requirePlatformAdmin();
  z.enum(["PENDING", "PUBLISHED", "REJECTED"]).parse(status);
  const [rows, pendingCount] = await Promise.all([
    prisma.meeting.findMany({
      where: { publication: { is: { status } } },
      select: eventSelect,
      orderBy: { publication: { submittedAt: "asc" } },
      take: 100,
    }),
    prisma.eventPublication.count({ where: { status: "PENDING" } }),
  ]);
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "event.approvals.read",
      targetId: status,
    },
  });
  return { events: rows.map(managed), pendingCount };
}
export async function reviewCampusEvent(input: unknown) {
  const d = eventReviewSchema.parse(input),
    actor = await requirePlatformAdmin();
  const result = await prisma.$transaction(async (tx) => {
    const e = await locked(tx, d.eventId, undefined, d.revision),
      p = e.publication!;
    if (p.status !== "PENDING")
      throw Error("This submission is no longer pending.");
    const membership = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: actor.id, clubId: e.clubId } },
    });
    // Only a successful independent review clears prior authorship. Submission or
    // rejection must not erase edits still awaiting approval (including legacy edits).
    // Read the durable audit baseline: draft edits clear Publication.reviewedAt.
    const baseline = await tx.auditLog.findFirst({
      where: { targetId: e.id, action: "event.published" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    // Support impersonation preserves the real actor in the same AuditLog.
    const authored = await tx.auditLog.findFirst({
      where: {
        targetId: e.id,
        actorId: actor.id,
        // Include timestamp ties conservatively rather than lose an author's edit.
        ...(baseline ? { createdAt: { gte: baseline.createdAt } } : {}),
        action: {
          in: [
            "event.draft.save",
            "event.flyer.upload",
            "event.submitted",
            "meeting.save",
            "platform.meeting.change",
          ],
        },
      },
      select: { id: true },
    });
    if (
      p.submittedBy === actor.id ||
      hasPermission(membership, "meetings.manage") ||
      authored
    )
      throw Error(
        "You cannot approve or reject your own club's event. Another administrator must review it.",
      );
    if (d.approved && e.date <= new Date())
      throw Error(
        "The event has already started. Return it for updated dates.",
      );
    await tx.eventPublication.update({
      where: { eventId: e.id },
      data: {
        status: d.approved ? "PUBLISHED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: actor.id,
        rejectionReason: d.approved ? null : d.reason,
        approvedRevision: d.approved ? e.revision : null,
        publishedAt: d.approved ? new Date() : null,
      },
    });
    for (const action of d.approved
      ? ["event.approved", "event.published"]
      : ["event.rejected"])
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          targetId: e.id,
          clubId: e.clubId,
          reason: d.reason || "Approved for public Corkboard",
          details: { revision: e.revision, submittedBy: p.submittedBy },
        },
      });
    return { success: true };
  });
  refresh();
  return result;
}
export async function getCampusEventRsvp(eventId: string) {
  z.string().uuid().parse(eventId);
  const { user } = await requireAuth();
  const r = await prisma.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    select: { eventId: true },
  });
  return { going: !!r };
}
export async function setCampusEventRsvp(input: unknown) {
  const d = z
      .object({ eventId: z.string().uuid(), going: z.boolean() })
      .strict()
      .parse(input),
    { user } = await requireAuth();
  const result = await prisma.$transaction(async (tx) => {
    const scope = await tx.meeting.findUniqueOrThrow({ where: { id: d.eventId }, select: { clubId: true } });
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${scope.clubId} FOR SHARE`;
    const e = await locked(tx, d.eventId),
      existing = await tx.eventRsvp.findUnique({
        where: { eventId_userId: { eventId: d.eventId, userId: user.id } },
      });
    if (!d.going) {
      await tx.eventRsvp.deleteMany({
        where: { eventId: d.eventId, userId: user.id },
      });
    } else if (!existing) {
      const p = e.publication!,
        now = new Date();
      if (
        !eventIsPublished(e) ||
        !p.rsvpEnabled ||
        e.date <= now ||
        (p.rsvpDeadline && p.rsvpDeadline <= now)
      )
        throw Error("RSVP is closed or this event is no longer published.");
      if (p.capacity !== null && e._count.rsvps >= p.capacity)
        throw Error("This event is full.");
      await tx.eventRsvp.create({
        data: { eventId: d.eventId, userId: user.id },
      });
    } else if (!eventIsPublished(e))
      throw Error(
        "This event is no longer published. You can still cancel your RSVP.",
      );
    const count = await tx.eventRsvp.count({ where: { eventId: d.eventId } });
    if (!!existing !== d.going)
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: d.going ? "event.rsvp.create" : "event.rsvp.cancel",
          targetId: e.id,
          clubId: e.clubId,
        },
      });
    return { going: d.going, count };
  });
  refresh();
  return result;
}
export async function getCampusEventAttendees(clubId: string, eventId: string) {
  z.string().uuid().parse(clubId);
  z.string().uuid().parse(eventId);
  await requireClubPermission(clubId, ["meetings.attendance"]);
  if (
    !(await prisma.meeting.findFirst({
      where: { id: eventId, clubId, publication: { isNot: null } },
      select: { id: true },
    }))
  )
    throw Error("Event unavailable.");
  const rows = await prisma.eventRsvp.findMany({
    where: { eventId },
    select: {
      createdAt: true,
      user: {
        select: {
          email: true,
          studentProfile: { select: { firstName: true, lastName: true } },
          applications: {
            where: {
              clubId,
              status: { not: "DRAFTING" },
              round: { anonymousReview: true },
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    createdAt: r.createdAt.toISOString(),
    name: r.user.applications.length
      ? "Anonymous applicant"
      : r.user.studentProfile
        ? `${r.user.studentProfile.firstName} ${r.user.studentProfile.lastName}`
        : r.user.email,
    email: r.user.applications.length ? null : r.user.email,
  }));
}
/** Keep cancellation available after withdrawal without exposing the new unapproved content. */
export async function getMyCampusEventRsvps() {
  const { user } = await requireAuth();
  const rows = await prisma.eventRsvp.findMany({
    where: { userId: user.id },
    select: {
      eventId: true,
      event: {
        select: {
          club: { select: { suspendedAt: true } },
          title: true,
          date: true,
          endDate: true,
          isPublic: true,
          audience: true,
          revision: true,
          publication: { select: { status: true, approvedRevision: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    eventId: r.eventId,
    title: eventIsPublished(r.event) ? r.event.title : "Event unavailable",
    available: eventIsPublished(r.event),
  }));
}

/** Elevated administrative visibility; public projections still require publication. */
export async function listAdminCampusEvents(input: unknown) {
  const actor = await requirePlatformAdmin();
  const f = z.object({ query: z.string().trim().max(200).default(""), status: z.enum(["", "DRAFT", "PENDING", "PUBLISHED", "REJECTED", "CANCELLED", "ARCHIVED"]).default("") }).strict().parse(input);
  const events = await prisma.meeting.findMany({ where: { publication: { is: f.status ? { status: f.status } : {} }, ...(f.query ? { OR: [{ title: { contains: f.query, mode: "insensitive" } }, { club: { name: { contains: f.query, mode: "insensitive" } } }] } : {}) }, select: eventSelect, orderBy: [{ date: "desc" }, { id: "asc" }], take: 100 });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.corkboard.read", targetId: "events", details: { result: "success", status: f.status } } });
  return events.map(managed);
}
