import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { createClient } from "@/utils/supabase/server";
import { viewTokenHash } from "@/utils/platform-view-as";
import {
  PLATFORM_VIEW_COOKIE,
  PLATFORM_VIEW_LIFETIME,
} from "@/lib/platform-view-as";
const startSchema = z.object({
  action: z.literal("start"),
  userId: z.string().uuid(),
  clubId: z.string().uuid().optional(),
  reason: z.string().trim().min(10).max(1000),
  confirmation: z.literal("VIEW ONLY"),
});
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const input = await request.json().catch(() => null),
    jar = await cookies();
  if (input?.action === "end") {
    try {
      const token = jar.get(PLATFORM_VIEW_COOKIE)?.value;
      if (token && /^[a-f0-9]{64}$/.test(token)) {
        const client = await createClient(jar),
          { data, error } = await client.auth.getUser();
        if (!error && data.user)
          await prisma.$transaction(async (tx) => {
            const session = await tx.platformViewSession.findUnique({
              where: { tokenHash: viewTokenHash(token) },
            });
            if (
              !session ||
              session.actorId !== data.user!.id ||
              session.endedAt
            )
              return;
            const ended = await tx.platformViewSession.updateMany({
              where: { id: session.id, endedAt: null },
              data: { endedAt: new Date() },
            });
            if (ended.count)
              await tx.auditLog.create({
                data: {
                  actorId: data.user!.id,
                  action: "platform.view-as.end",
                  targetId: session.targetUserId,
                  clubId: session.clubId,
                  reason: "Administrator exited read-only view",
                  details: { sessionId: session.id },
                },
              });
          });
      }
    } catch {
      return NextResponse.json(
        { error: "Could not end the session safely. Please retry." },
        { status: 503 },
      );
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(PLATFORM_VIEW_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }
  try {
    const actor = await requirePlatformAdmin(),
      data = startSchema.parse(input);
    if (data.userId === actor.id) throw new Error("Choose a different user.");
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + PLATFORM_VIEW_LIFETIME);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
      const target = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, disabledAt: true },
      });
      if (
        !target ||
        target.disabledAt ||
        (await tx.platformAdmin.findUnique({ where: { userId: data.userId } }))
      )
        throw new Error("This account cannot be viewed.");
      if (
        data.clubId &&
        !(await tx.clubMember.findUnique({
          where: {
            userId_clubId: { userId: data.userId, clubId: data.clubId },
          },
        }))
      )
        throw new Error("The user is not a member of that workspace.");
      const prior = await tx.platformViewSession.findMany({
        where: { actorId: actor.id, endedAt: null },
      });
      for (const session of prior) {
        await tx.platformViewSession.update({
          where: { id: session.id },
          data: { endedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "platform.view-as.end",
            targetId: session.targetUserId,
            clubId: session.clubId,
            reason: "Superseded by a new view session",
            details: { sessionId: session.id },
          },
        });
      }
      const session = await tx.platformViewSession.create({
        data: {
          actorId: actor.id,
          targetUserId: data.userId,
          clubId: data.clubId,
          reason: data.reason,
          tokenHash: viewTokenHash(token),
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "platform.view-as.start",
          targetId: data.userId,
          clubId: data.clubId,
          reason: data.reason,
          details: {
            sessionId: session.id,
            mode: "READ_ONLY",
            expiresAt: expiresAt.toISOString(),
          },
        },
      });
    });
    const response = NextResponse.json({ success: true });
    // Keep the context marker until explicit exit: even an expired view must never silently resume writes.
    response.cookies.set(PLATFORM_VIEW_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "View-as access denied or invalid request. Verify MFA, target membership, reason, and confirmation.",
      },
      { status: 403 },
    );
  }
}
