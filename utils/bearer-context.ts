import { AsyncLocalStorage } from "node:async_hooks";
import type { requireBearerAuth } from "@/utils/bearer-auth";

type BearerIdentity = Awaited<ReturnType<typeof requireBearerAuth>>;

/**
 * Request-scoped identity for native-client routes (/api/v1). A route verifies
 * the bearer token with `requireBearerAuth` first, then runs the existing
 * action inside this scope, so `requireAuth()` (and everything built on it,
 * including `requireClubPermission`) resolves the verified token's account
 * instead of reading cookies. The scope ends with the callback; nothing is
 * shared across requests or users. Only `withBearerIdentity` can enter it.
 */
const store = new AsyncLocalStorage<BearerIdentity>();

export function bearerIdentity(): BearerIdentity | undefined {
  return store.getStore();
}

export async function withBearerIdentity<T>(request: Request, run: (identity: BearerIdentity) => Promise<T>): Promise<T> {
  // Loaded lazily so the cookie path (utils/auth.ts) never pulls in the bearer verifier.
  const { requireBearerAuth } = await import("@/utils/bearer-auth");
  const identity = await requireBearerAuth(request);
  return store.run(identity, () => run(identity));
}
