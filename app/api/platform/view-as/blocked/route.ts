import { NextRequest, NextResponse } from "next/server";
import { platformViewSession } from "@/utils/platform-view-as";
import { prisma } from "@/utils/prisma";
async function blocked(request: NextRequest) {
  try {
    const session = await platformViewSession();
    if (session)
      await prisma.auditLog.create({
        data: {
          actorId: session.actorId,
          action: "platform.view-as.write-blocked",
          targetId: session.targetUserId,
          clubId: session.clubId,
          reason: "Mutation attempted during read-only view",
          details: {
            sessionId: session.id,
            path:
              request.headers.get("x-outclass-blocked-path")?.slice(0, 500) ??
              "unknown",
            method: request.method,
          },
        },
      });
  } catch {
    /* Denial must hold even when authentication or audit storage is unavailable. */
  }
  return NextResponse.json(
    { error: "Read-only administrator view. Exit before making changes." },
    { status: 403 },
  );
}
export { blocked as POST, blocked as PUT, blocked as PATCH, blocked as DELETE };
