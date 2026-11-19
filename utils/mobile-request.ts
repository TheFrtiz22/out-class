import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The native app's request identity (docs/mobile/architecture.md).
 *
 * A mobile API route (app/api/mobile/v1, through utils/mobile-api.ts) is the only code that
 * opens this context. Inside it, `getSessionState` in utils/auth.ts verifies the bearer access
 * token with exactly the checks a cookie session gets (remote getUser, live auth.sessions row,
 * second factor), and every action or loader then runs its own unchanged authorization.
 * Nothing here is read from a request header by shared code: a header alone never selects
 * this path, so a browser request cannot opt in to it.
 */
export type MobileRequestContext = {
  /** The Supabase access token from `Authorization: Bearer`. Unverified until getSessionState runs.
   * Empty for a public operation called without a token: that request is signed out, whatever cookies it carries. */
  readonly token: string;
  /** A state-changing request: gets the same maintenance-mode refusal as a Server Action. */
  readonly write: boolean;
  /** Per-request memo of the verified session (React's `cache` does not memoize in route handlers). */
  session?: Promise<unknown>;
};

const storage = new AsyncLocalStorage<MobileRequestContext>();

export const mobileRequest = (): MobileRequestContext | undefined => storage.getStore();

export function runMobileRequest<T>(context: { token: string; write: boolean }, run: () => Promise<T>): Promise<T> {
  return storage.run({ token: context.token, write: context.write }, run);
}
