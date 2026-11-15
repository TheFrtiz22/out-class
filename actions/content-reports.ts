"use server";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { hasPermission, hasWorkspace } from "@/lib/permissions";
import { eventIsPublished } from "@/lib/campus-events";
import { readMarketing } from "@/lib/club-marketing";
import { presentPublicMarketing } from "@/lib/public-club-content";
import {
  REPORT_CONFIRMATION, REPORT_DEDUPE_MS, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS, REPORT_UNAVAILABLE, TERMS_DMCA_HREF,
  reportInputSchema, reportSummary, type ReportTarget,
} from "@/lib/content-reports";

type Resolved = { kind: "USER" | "CLUB" | "EVENT" | "CONTENT"; targetId: string; context: Record<string, string> };
type Result = { ok: true; message: string; dmcaHref?: string } | { ok: false; error: string };
const OWN = "You can’t report your own content.";

/** Staff of a club (anyone with a club workspace) own its profile, gallery, events and flyers. */
async function clubStaff(userId: string, clubId: string) {
  const member = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } }, select: { status: true, alumniSince: true, isOwner: true, permissions: true, interviewOffices: true } });
  return !!member && hasWorkspace(member);
}

/**
 * Resolves a browser-supplied target to the stored report target, only when the reporter
 * can already see it. Every miss returns null so a report never confirms hidden content.
 */
async function resolveTarget(userId: string, target: ReportTarget): Promise<Resolved | "own" | null> {
  switch (target.type) {
    case "club": {
      const club = await prisma.club.findFirst({ where: { id: target.id, suspendedAt: null }, select: { id: true } });
      if (!club) return null;
      if (await clubStaff(userId, club.id)) return "own";
      return { kind: "CLUB", targetId: club.id, context: {} };
    }
    case "club-image": {
      const club = await prisma.club.findFirst({ where: { id: target.clubId, suspendedAt: null }, select: { id: true, marketing: true } });
      const image = club && presentPublicMarketing(readMarketing(club.marketing)).gallery.filter(g => g.url)[target.index];
      if (!club || !image) return null;
      if (await clubStaff(userId, club.id)) return "own";
      return { kind: "CONTENT", targetId: `club-image:${club.id}:${target.index}`, context: /^data:/.test(image.url) ? {} : { image: image.url.slice(0, 300) } };
    }
    case "event":
    case "event-flyer": {
      const eventId = target.type === "event" ? target.id : target.eventId;
      const event = await prisma.meeting.findUnique({ where: { id: eventId }, select: { id: true, clubId: true, isPublic: true, audience: true, revision: true, club: { select: { suspendedAt: true } }, publication: { select: { status: true, approvedRevision: true, flyerId: true } } } });
      if (!event || !eventIsPublished(event)) return null;
      if (target.type === "event-flyer" && !event.publication?.flyerId) return null;
      if (await clubStaff(userId, event.clubId)) return "own";
      return target.type === "event"
        ? { kind: "EVENT", targetId: event.id, context: {} }
        : { kind: "CONTENT", targetId: `event-flyer:${event.id}:${event.publication!.flyerId}`, context: {} };
    }
    case "student": {
      // Leaders see another student's profile only in their own club's applicant review.
      const member = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId, clubId: target.clubId } }, select: { status: true, alumniSince: true, isOwner: true, permissions: true } });
      if (!hasPermission(member, "applications.review")) return null;
      const app = await prisma.application.findFirst({ where: { id: target.applicationId, clubId: target.clubId, status: { not: "DRAFTING" } }, select: { id: true, studentId: true } });
      if (!app) return null;
      if (app.studentId === userId) return "own";
      return { kind: "USER", targetId: app.studentId, context: { applicationId: app.id, clubId: target.clubId } };
    }
    case "announcement": {
      // Only a recipient (the inbox row is the immutable audience snapshot) can report it.
      const received = await prisma.userNotification.findFirst({ where: { userId, announcementId: target.id }, select: { announcement: { select: { id: true, clubId: true, authorId: true } } } });
      const a = received?.announcement;
      if (!a) return null;
      if (a.authorId === userId) return "own";
      return { kind: "CONTENT", targetId: `announcement:${a.clubId}:${a.id}`, context: {} };
    }
  }
}

/**
 * Report user-generated content to the OutClass team. Writes one PlatformReport and one
 * audit row; never notifies the reported person or club. Errors are returned, not thrown,
 * because production redacts thrown Server Action messages.
 */
export async function reportContent(input: unknown): Promise<Result> {
  const { user, impersonation } = await requireAuth();
  if (impersonation) return { ok: false, error: "Reports can’t be filed during a support session." };
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: REPORT_UNAVAILABLE };
  const { target, reason, details } = parsed.data;
  const resolved = await resolveTarget(user.id, target);
  if (resolved === "own") return { ok: false, error: OWN };
  if (!resolved) return { ok: false, error: REPORT_UNAVAILABLE };
  const done: Result = { ok: true, message: REPORT_CONFIRMATION, ...(reason === "COPYRIGHT" ? { dmcaHref: TERMS_DMCA_HREF } : {}) };
  const context = Object.entries(resolved.context).map(([k, v]) => `${k}: ${v}`).join("\n");
  const summary = reportSummary(reason, target.type, [details, context].filter(Boolean).join("\n\n"));
  return prisma.$transaction(async tx => {
    // Serialize one reporter's submissions so the dedupe and rate checks cannot race.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    const now = Date.now();
    const duplicate = await tx.platformReport.findFirst({ where: { reporterId: user.id, kind: resolved.kind, targetId: resolved.targetId, createdAt: { gte: new Date(now - REPORT_DEDUPE_MS) } }, select: { id: true } });
    if (duplicate) return done;
    if (await tx.platformReport.count({ where: { reporterId: user.id, kind: { not: "SUPPORT" }, createdAt: { gte: new Date(now - REPORT_RATE_WINDOW_MS) } } }) >= REPORT_RATE_LIMIT)
      return { ok: false, error: "You’ve sent several reports recently. Try again later." } as Result;
    const report = await tx.platformReport.create({ data: { kind: resolved.kind, targetId: resolved.targetId, reporterId: user.id, summary } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "platform.report.create", targetId: report.id, details: { kind: resolved.kind, targetType: target.type, reason, result: "success" } } });
    return done;
  });
}
