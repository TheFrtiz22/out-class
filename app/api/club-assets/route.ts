import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/prisma";
import { clubAssetReference, clubProfileImages } from "@/lib/club-assets";
import { privateClubAssetStorage } from "@/utils/club-asset-storage";
import { requireClubPermission } from "@/utils/auth";
import { requirePlatformAdmin } from "@/utils/platform-admin";
const missing = () => new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if ([...params.keys()].some(k => !['reference','preview'].includes(k)) || params.getAll('reference').length !== 1 || params.getAll('preview').length > 1 || (params.has('preview') && params.get('preview') !== '1')) return missing();
  const parsed = clubAssetReference.safeParse(params.get('reference'));
  if (!parsed.success) return missing();
  const reference = parsed.data, clubId = reference.split('/')[1], preview = params.get('preview') === '1';
  async function allowed() {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { logoUrl: true, bannerUrl: true, marketing: true, suspendedAt: true, isDiscoverable: true } });
    if (!club) return false;
    if (preview) {
      try { await requireClubPermission(clubId, ['club.settings']); return true; }
      catch { try { await requirePlatformAdmin(); return true; } catch { return false; } }
    }
    return !club.suspendedAt && clubProfileImages(club, true).includes(reference);
  }
  try {
    if (!await allowed()) return missing();
    const storage = await privateClubAssetStorage();
    const { data, error } = await storage.download(reference.slice('club-assets/'.length));
    if (error || !data || !await allowed()) return missing();
    const mime = reference.endsWith('.jpg') ? 'image/jpeg' : reference.endsWith('.png') ? 'image/png' : 'image/webp';
    return new NextResponse(await data.arrayBuffer(), { headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return missing(); }
}
