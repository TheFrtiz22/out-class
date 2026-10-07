import { sameOriginRequest } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isUvaEmail } from "@/lib/auth";
import { freshAuthClient } from "@/utils/admin-elevation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prisma";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
const schema = z.object({ email: z.string().trim().toLowerCase().email().refine(isUvaEmail), tokenHash: z.string().regex(/^[a-f0-9]{56,64}$/), password: z.string().min(12).max(72) }).strict();
export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const jar = await cookies();
    if (jar.has(PLATFORM_VIEW_COOKIE)) throw Error("Return from impersonation before claiming an account.");
    const d = schema.parse(await request.json());
    const normal = await createClient(jar), current = await normal.auth.getUser();
    if (current.data.user && current.data.user.email?.toLowerCase() !== d.email) throw Error("Sign out of the other account before claiming this invitation.");
    // Check the provider-owned invite binding before verifyOtp consumes it. No copy of
    // the invitation secret or separate invitation model is stored by OutClass.
    const pending = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM auth.users WHERE lower(email)=${d.email} AND confirmation_token=${d.tokenHash} AND invited_at IS NOT NULL AND email_confirmed_at IS NULL`;
    if (pending.length !== 1) throw Error("Invitation expired, already claimed, or belongs to another address.");
    const account = await prisma.user.findUnique({ where: { id: pending[0].id } });
    if (!account || account.disabledAt || account.email.toLowerCase() !== d.email) throw Error("Account unavailable. Contact support.");
    const client = freshAuthClient();
    const verified = await client.auth.verifyOtp({ token_hash: d.tokenHash, type: "invite" });
    if (verified.error || !verified.data.session || verified.data.user?.email?.toLowerCase() !== d.email) throw Error("Invitation expired, already claimed, or belongs to another address.");
    const user = verified.data.user;
    if (user.id !== account.id) throw Error("Invitation identity unavailable.");
    const changed = await client.auth.updateUser({ password: d.password });
    if (changed.error) throw Error("Could not set your password. Request a new invitation.");
    await prisma.auditLog.create({ data: { actorId: user.id, action: "student.invitation.claim", targetId: user.id, details: { result: "success" } } });
    const attached = await normal.auth.setSession(verified.data.session);
    if (attached.error) throw Error("Account claimed. Sign in with your new password.");
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not claim invitation." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
