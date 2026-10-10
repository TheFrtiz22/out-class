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

export async function uploadClubAsset(input: FormData) {
  const keys = ['clubId', 'file', 'admin'];
  if ([...input.keys()].some(k => !keys.includes(k)) || keys.some(k => input.getAll(k).length !== 1)) throw Error("Provide one club, file and upload mode.");
  const clubId = z.string().uuid().parse(input.get('clubId'));
  const admin = z.enum(['true','false']).parse(input.get('admin')) === 'true';
  const actor = admin ? await requirePlatformAdmin() : (await requireClubPermission(clubId, ['club.settings'])).user;
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
