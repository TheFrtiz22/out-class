"use server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { authorizeAdminTransaction } from "@/utils/admin-transaction";
import { adminPageLoad, logAdminFailure } from "@/utils/admin-page";
import { AdminAccessError } from "@/lib/admin-failure";
import { redirect } from "next/navigation";
import { assertClubImageAssignment } from "@/utils/club-asset-storage";
import { adminClubInput, adminClubFilters } from "@/lib/admin-clubs";
import { profileDraft } from "@/lib/club-marketing";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
const editable = { id: true, name: true, slug: true, schoolId: true, campusKey: true, tagline: true, description: true, category: true, color: true, logoUrl: true, bannerUrl: true, marketing: true, acceptanceRate: true, aumValue: true, isDiscoverable: true, applicationOpen: true, applicationDeadline: true, suspendedAt: true } as const;
function version(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export async function getAdminClubs(input: unknown = {}) {
  await requirePlatformAdmin();
  const f = adminClubFilters.parse(input), contains = { contains: f.query, mode: 'insensitive' as const };
  const where = { ...(f.query ? { OR: [{ name: contains }, { slug: contains }, { category: contains }] } : {}), ...(f.status==='ACTIVE' ? { suspendedAt: null } : f.status==='SUSPENDED' ? { suspendedAt: { not: null } } : f.status==='DISCOVERABLE' ? { isDiscoverable: true, suspendedAt: null } : f.status==='HIDDEN' ? { isDiscoverable: false } : f.status==='RECRUITING' ? { suspendedAt: null, applicationOpen: true, AND: [{ OR: [{ applicationDeadline: null }, { applicationDeadline: { gt: new Date() } }] }], pipelineRounds: { some: { archivedAt: null } } } : {}) };
  const [rows, schools] = await Promise.all([
    prisma.club.findMany({ where, select: { id: true, name: true, slug: true, logoUrl: true, category: true, tagline: true, isDiscoverable: true, suspendedAt: true, applicationOpen: true, applicationDeadline: true, school: { select: { name: true } }, _count: { select: { members: { where: { status: 'ACTIVE' } }, pipelineRounds: { where: { archivedAt: null } } } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: f.page*30, take: 31 }),
    prisma.school.findMany({ where: { active: true }, select: { id: true, key: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { rows: rows.slice(0,30).map(c => ({ ...c, suspendedAt: c.suspendedAt?.toISOString() || null, applicationDeadline: c.applicationDeadline?.toISOString() || null })), schools, hasMore: rows.length > 30 };
}
export async function loadAdminClubs(input: unknown = {}) { return adminPageLoad('/platform/clubs', () => getAdminClubs(input), 'ADMIN_CLUB_LOAD_FAILED'); }
export async function getAdminClub(id: string) {
  return adminPageLoad('/platform/clubs', async () => {
    await requirePlatformAdmin(); z.string().uuid().parse(id);
    const club = await prisma.club.findUniqueOrThrow({ where: { id }, select: editable });
    return { id: club.id, slug: club.slug, schoolId: club.schoolId, campusKey: club.campusKey, isDiscoverable: club.isDiscoverable, applicationOpen: club.applicationOpen, applicationDeadline: club.applicationDeadline?.toISOString() || null, suspendedAt: club.suspendedAt?.toISOString() || null, profile: profileDraft(club), version: version(club) };
  }, 'ADMIN_CLUB_LOAD_FAILED');
}
export async function saveAdminClub(input: unknown): Promise<{ id?: string; error?: string; supportCode?: string }> {
  const parsed = adminClubInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    const actor = await requirePlatformAdmin();
    const result = await prisma.$transaction(async tx => {
      if (d.id) await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${d.id} FOR UPDATE`;
      await authorizeAdminTransaction(tx, actor.id);
      const previous = d.id ? await tx.club.findUniqueOrThrow({ where: { id: d.id }, select: editable }) : null;
      if (previous && version(previous)!==d.version) return { error: 'Club changed. Reload before saving.' };
      const school = await tx.school.findUnique({ where: { id: d.schoolId }, select: { id: true, key: true, active: true } });
      if (!school?.active || previous && (previous.schoolId!==school.id || previous.campusKey!==school.key)) return { error: 'School/campus cannot change through profile editing. Resolve existing school relationships first.' };
      if (previous) await assertClubImageAssignment(tx, previous.id, d.profile, previous);
      else if (d.profile.logoUrl || d.profile.bannerUrl || d.profile.marketing.gallery.length || d.profile.marketing.sections.some(s => s.cards.some(c => c.image))) return { error: 'Create the club before uploading its images.' };
      const fields = { ...d.profile, slug: d.slug, schoolId: school.id, campusKey: school.key, isDiscoverable: d.isDiscoverable, applicationOpen: d.applicationOpen, applicationDeadline: d.applicationDeadline ? new Date(d.applicationDeadline) : null };
      const club = previous ? await tx.club.update({ where: { id: previous.id }, data: { ...fields, applicationVersion: { increment: previous.applicationOpen !== fields.applicationOpen || previous.applicationDeadline?.toISOString() !== fields.applicationDeadline?.toISOString() ? 1 : 0 } } }) : await tx.club.create({ data: fields });
      await tx.auditLog.create({ data: { actorId: actor.id, action: previous ? 'platform.club.profile.update' : 'platform.club.create', targetId: club.id, clubId: club.id, details: { reason: d.reason } } });
      return { id: club.id };
    }, { timeout: 20000 });
    revalidateTag('club-directory'); revalidatePath('/platform/clubs'); if (result.id) revalidatePath(`/club/${result.id}`);
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002') return { error: 'That slug is already in use. Choose another slug.' };
    const supportCode = logAdminFailure('/platform/clubs', error, 'ADMIN_CLUB_SAVE_FAILED');
    if (error instanceof AdminAccessError) redirect('/platform/login');
    return { error: 'Club could not be saved. Your edits are still here.', supportCode };
  }
}
