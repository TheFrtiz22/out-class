import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";

// A lexical async scope prevents recursion while resolving the REAL administrator.
// Never use enterWith: it could leak identity between concurrent requests.
export const supportInternal = new AsyncLocalStorage<boolean>();
export async function supportContext() {
  if (supportInternal.getStore()) return null;
  let jar;
  try { jar = await cookies(); } catch (error) {
    if (error instanceof Error && /outside a request scope/.test(error.message)) return null;
    throw error;
  }
  if (!jar.has(PLATFORM_VIEW_COOKIE)) return null;
  return supportInternal.run(true, async () => {
    const { platformViewSession } = await import("@/utils/platform-view-as");
    const session = await platformViewSession();
    if (!session) throw new Error("Impersonation expired or unavailable. Exit impersonation to continue.");
    return session;
  });
}

/** External side effects (e.g. signed Storage capabilities) also require an audit before issuance. */
export async function auditSupportAction(action: string, targetId: string) {
  const session = await supportContext();
  if (!session) return;
  const { prisma } = await import("@/utils/prisma");
  await supportInternal.run(true, () => prisma.auditLog.create({ data: {
    actorId: session.actorId, effectiveUserId: session.targetUserId,
    supportSessionId: session.id, action, targetId,
    details: { outcome: "attempt", reason: session.reason },
  } }));
}
