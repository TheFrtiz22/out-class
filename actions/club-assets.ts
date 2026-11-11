"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { authorizeAdminTransaction } from "@/utils/admin-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { privateClubAssetStorage } from "@/utils/club-asset-storage";
import { prepareClubImage } from "@/lib/club-image";
import { UPLOAD_QUOTA_MESSAGES, UPLOAD_QUOTAS, uploadQuotaError, uploadWindowStart } from "@/lib/upload-quotas";

export async function uploadClubAsset(input: FormData) {
  const keys = ['clubId', 'file', 'admin'];
  if ([...input.keys()].some(k => !keys.includes(k)) || keys.some(k => input.getAll(k).length !== 1)) throw Error("Provide one club, file and upload mode.");
  const clubId = z.string().uuid().parse(input.get('clubId'));
  const admin = z.enum(['true','false']).parse(input.get('admin')) === 'true';
  const actor = admin ? await requirePlatformAdmin({ fresh: true }) : (await requireClubPermission(clubId, ['club.settings'])).user;
  const file = input.get('file');
  if (!file || typeof file === 'string' || !file.size || file.size > 5242880) throw Error("Choose a PNG, JPEG or WebP up to 5 MB.");
  if (/[\\/\x00-\x1f\x7f%?#]/.test(file.name)) throw Error("Invalid image filename.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = await prepareClubImage(bytes, file.type);
  const mime = image.mime;
  const extensions = mime === 'image/jpeg' ? ['jpg','jpeg'] : mime === 'image/png' ? ['png'] : ['webp'];
  if (!extensions.includes(file.name.split('.').pop()!.toLowerCase())) throw Error("Image extension must match its type.");
  const path = `${clubId}/${randomUUID()}.webp`;
  const storage = await privateClubAssetStorage();
  let uploaded = false;
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
      if (admin) await authorizeAdminTransaction(tx, actor.id);
      else await authorizeClubTransaction(tx, clubId, actor.id, ['club.settings']);
      if (!await tx.club.findUnique({ where: { id: clubId }, select: { id: true } })) throw Error("Club unavailable.");
      const since = uploadWindowStart();
      const userRecent = await tx.auditLog.count({ where: { actorId: actor.id, action: 'club.asset.upload', createdAt: { gte: since } } });
      const clubRecent = await tx.auditLog.count({ where: { clubId, action: 'club.asset.upload', createdAt: { gte: since } } });
      // Replaced club images stay in Storage, so the stored total is the sum of this club's objects.
      const [stored] = await tx.$queryRaw<{ bytes: bigint | number | null }[]>`SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) AS bytes FROM storage.objects WHERE bucket_id='club-assets' AND name LIKE ${clubId + '/%'}`;
      const quota = uploadQuotaError({ userRecent, clubRecent, clubBytes: Number(stored?.bytes ?? 0), incomingBytes: image.bytes.length }, UPLOAD_QUOTAS.clubAsset, UPLOAD_QUOTA_MESSAGES.clubAssetStorage);
      if (quota) throw Error(quota);
      const { error } = await storage.upload(path, image.bytes, { contentType: image.contentType, upsert: false, cacheControl: '0' });
      if (error) throw Error("Image upload failed. Your saved profile has not changed.");
      uploaded = true;
      if (admin) await authorizeAdminTransaction(tx, actor.id);
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'club.asset.upload', targetId: clubId, clubId, details: { mime, size: bytes.length } } });
      return { reference: `club-assets/${path}` };
    }, { timeout: 20000 });
  } catch (error) {
    if (uploaded) { try { await storage.remove([path]); } catch { /* An orphan never replaces the authoritative profile. */ } }
    throw error;
  }
}
