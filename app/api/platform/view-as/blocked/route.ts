import { NextRequest, NextResponse } from "next/server";
import { platformViewSession } from "@/utils/platform-view-as";
import { prisma } from "@/utils/prisma";
import { RATE_LIMITS, limitRequest } from "@/lib/rate-limit";
async function blocked(request: NextRequest) {
  // Over the limit the request is still denied, just without another audit row.
  if (limitRequest(request, RATE_LIMITS.adminViewAsBlocked))
    return NextResponse.json(
      { error: "This operation is unavailable during impersonation. Exit impersonation first." },
      { status: 403 },
    );
  try {
    const session = await platformViewSession();
    if (session)
      await prisma.auditLog.create({
        data: {
          actorId: session.actorId,
          action: "platform.view-as.write-blocked",
          targetId: session.targetUserId,
          clubId: session.clubId,
          reason: "Operation unavailable during impersonation",
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
    { error: "This operation is unavailable during impersonation. Exit impersonation first." },
    { status: 403 },
  );
}
export { blocked as POST, blocked as PUT, blocked as PATCH, blocked as DELETE };
