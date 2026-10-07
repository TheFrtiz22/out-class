import { sameOriginRequest } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/utils/prisma";
import { createClient } from "@/utils/supabase/server";
import { elevationHash } from "@/utils/admin-elevation";
import { supportInternal } from "@/utils/support-audit";
import { ADMIN_ELEVATION_COOKIE, ADMIN_CHALLENGE_COOKIE, adminCookieOptions } from "@/lib/admin-elevation";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const jar = await cookies(), token = jar.get(ADMIN_ELEVATION_COOKIE)?.value, challengeToken = jar.get(ADMIN_CHALLENGE_COOKIE)?.value;
    await supportInternal.run(true, async () => {
      if ((token && /^[a-f0-9]{64}$/.test(token)) || (challengeToken && /^[a-f0-9]{64}$/.test(challengeToken))) await prisma.$transaction(async tx => {
        const row = token && /^[a-f0-9]{64}$/.test(token) ? await tx.adminElevation.findUnique({ where: { tokenHash: elevationHash(token) } }) : await tx.adminElevationChallenge.findUnique({ where: { tokenHash: elevationHash(challengeToken!) } });
        if (!row) return;
        await tx.adminElevation.updateMany({ where: { actorId: row.actorId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.adminElevationChallenge.updateMany({ where: { actorId: row.actorId, consumedAt: null }, data: { consumedAt: new Date(), encryptedCredentials: "" } });
        await tx.platformViewSession.updateMany({ where: { actorId: row.actorId, endedAt: null }, data: { endedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: row.actorId, action: "platform.elevation.logout", targetId: row.id, details: { result: "revoked" } } });
      });
    });
    for (const name of [ADMIN_ELEVATION_COOKIE, ADMIN_CHALLENGE_COOKIE, PLATFORM_VIEW_COOKIE]) jar.set(name, "", { ...adminCookieOptions, maxAge: 0 });
    const client = await createClient(jar);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw Error("Could not sign out.");
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Could not sign out safely. Try again." }, { status: 503 }); }
}
