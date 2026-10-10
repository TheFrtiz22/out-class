import type { AppTransactionClient } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { authSessionId } from "@/utils/admin-elevation";
import { AdminAccessError } from "@/lib/admin-failure";
/** Hold revocation boundaries while retaining every existing elevated Admin gate. */
export async function authorizeAdminTransaction(tx: AppTransactionClient, actorId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actorId} FOR SHARE`;
  await tx.$queryRaw`SELECT "userId" FROM "PlatformAdmin" WHERE "userId"=${actorId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "AdminElevation" WHERE "actorId"=${actorId} FOR SHARE`;
  const actor = await requirePlatformAdmin();
  if (actor.id !== actorId) throw new AdminAccessError("ADMIN_ACCESS_DENIED", "Administrator access changed.");
  const session = await authSessionId();
  const live = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM auth.sessions WHERE id=${session}::uuid AND user_id=${actorId}::uuid AND (not_after IS NULL OR not_after>clock_timestamp()) FOR SHARE`;
  if (!live.length) throw new AdminAccessError("ADMIN_SESSION_EXPIRED", "Authentication session ended.");
}
