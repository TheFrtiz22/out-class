import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { supportContext, supportTransactionScope } from "@/utils/support-audit";
import { requireAdminElevation } from "@/utils/admin-elevation";

// Acquisition, lock and execution budgets are separate. Never retry a timed-out
// transaction automatically: callers may retry their idempotent command.
export const clubWriteLimits = { maxWait: 5_000, timeout: 15_000 } as const;
export const votingWriteLimits = { maxWait: 5_000, timeout: 30_000 } as const;

/** Resolve provider authentication before holding business locks. Inside the
 * transaction each audited write rechecks live DB authority, and the final check
 * rolls back all business writes if support authority ended during the command.
 * Durable attempt/statement audits still use the independent base connection.
 */
export async function clubWriteTransaction<T>(
  work: (tx: AppTransactionClient) => Promise<T>,
  limits: { maxWait: number; timeout: number } = clubWriteLimits,
): Promise<T> {
  const session = await supportContext();
  const elevation = session ? await requireAdminElevation(session.actorId) : null;
  return prisma.$transaction(async tx => {
    // PostgreSQL cancels contended locks before the interactive transaction dies.
    await tx.$queryRaw`SELECT set_config('lock_timeout', '3000', true), set_config('statement_timeout', '10000', true)`;
    const validate = async () => {
      if (!session || !elevation) return;
      const allowed = (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(id => id.trim());
      if (!allowed.includes(session.actorId) || allowed.includes(session.targetUserId))
        throw new Error("Impersonation expired or unavailable. Exit impersonation to continue.");
      const live = await tx.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM "PlatformViewSession" s
        JOIN "User" actor ON actor.id=s."actorId" AND actor."disabledAt" IS NULL
        JOIN "User" target ON target.id=s."targetUserId" AND target."disabledAt" IS NULL
        JOIN "PlatformAdmin" g ON g."userId"=actor.id AND g.active
        JOIN "AdminElevation" e ON e.id=${elevation.id} AND e."actorId"=actor.id
        JOIN auth.sessions a ON a.id=e."authSessionId"::uuid AND a.user_id=actor.id::uuid
        WHERE s.id=${session.id} AND s."actorId"=${session.actorId} AND s."targetUserId"=${session.targetUserId}
          AND s.mode='IMPERSONATION' AND s."endedAt" IS NULL AND s."expiresAt">clock_timestamp()
          AND e."revokedAt" IS NULL AND (e."expiresAt" IS NULL OR e."expiresAt">clock_timestamp())
          AND e."authSessionId"=${elevation.authSessionId}
          AND e."passwordVerifiedAt"<=e."mfaVerifiedAt" AND e."mfaVerifiedAt"<=clock_timestamp()
          AND (a.not_after IS NULL OR a.not_after>clock_timestamp())
          AND NOT EXISTS (SELECT 1 FROM "PlatformAdmin" privileged WHERE privileged."userId"=target.id)`;
      if (!live.length) throw new Error("Impersonation expired or unavailable. Exit impersonation to continue.");
    };
    return supportTransactionScope.run({ session, validate }, async () => {
      await validate();
      const result = await work(tx);
      await validate();
      return result;
    });
  }, limits);
}
