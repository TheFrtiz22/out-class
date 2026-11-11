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

/** True for lock waits, transaction timeouts and serialization conflicts: the
 * command did not run and the caller may simply try again. */
export function isWriteContention(error: unknown) {
  const e = error as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
  if (!e || typeof e !== "object") return false;
  if (e.code === "P2028" || e.code === "P2034") return true;
  if (e.meta?.code === "55P03" || e.meta?.code === "40001" || e.meta?.code === "40P01") return true;
  return typeof e.message === "string" && /lock timeout|could not obtain lock|could not serialize access/i.test(e.message);
}

/** Shown when a write keeps losing to concurrent writers. Never carries database detail. */
export const TRANSACTION_CONFLICT_MESSAGE = "Someone else just changed this. Try again.";

/** Retries ran out. The database error stays on `cause` for server logs only. */
export class TransactionConflictError extends Error {
  constructor(cause?: unknown) {
    super(TRANSACTION_CONFLICT_MESSAGE, { cause });
    this.name = "TransactionConflictError";
  }
}

/** PostgreSQL aborted the whole transaction (deadlock 40P01 or serialization
 * failure 40001) and rolled it back, so re-running it from the start is safe.
 * Lock and statement timeouts (55P03, 57014) and Prisma's transaction timeout
 * (P2028) are deliberately excluded: they signal sustained load, not a race. */
export function isTransactionConflict(error: unknown) {
  const e = error as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
  if (!e || typeof e !== "object") return false;
  if (e.code === "P2034" || e.meta?.code === "40P01" || e.meta?.code === "40001") return true;
  return typeof e.message === "string" && /deadlock detected|could not serialize access/i.test(e.message);
}

type ConflictRetryOptions = { attempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void>; random?: () => number };

/** Re-runs a whole transaction that PostgreSQL aborted as a deadlock or
 * serialization victim, at most `attempts` times with a short jittered backoff.
 * `run` must start a fresh transaction each call. Any other error is rethrown
 * unchanged; exhausted retries throw TransactionConflictError. */
export async function retryTransactionConflict<T>(run: () => Promise<T>, options: ConflictRetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 25, sleep = ms => new Promise<void>(resolve => setTimeout(resolve, ms)), random = Math.random } = options;
  for (let attempt = 1; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt >= attempts) throw new TransactionConflictError(error);
      // Exponential base plus jitter so the two victims of a cycle do not collide again in step.
      await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.floor(random() * baseDelayMs));
    }
  }
}
