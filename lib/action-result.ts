/**
 * Expected Server Action failures that must reach the user.
 *
 * In production Next.js replaces the message of any error a Server Action
 * throws with a generic "An error occurred in the Server Components render…"
 * text and a digest. Returned values are serialized as-is, so an action that
 * wants its message shown returns a branded result instead of throwing:
 *
 *   server: `return actionResult(async () => { … throw new ActionError("…") … })`
 *   client: `unwrapAction(await action(…))` (lib/workspace-api.ts does this for
 *           every adapted action), then `userMessage(error, fallback)`.
 *
 * Only `ActionError` messages become results. Anything else (Prisma, Supabase,
 * bugs, redirects) is rethrown untouched, so the client shows its fallback.
 */
export const ACTION_RESULT_BRAND = "outclass.action/v1" as const

// A registry symbol, so the brand survives duplicated module instances.
const actionErrorBrand = Symbol.for("outclass.action-error")

export class ActionError extends Error {
  readonly code: string
  readonly [actionErrorBrand] = true
  constructor(message: string, code = "ACTION_REFUSED") {
    super(message)
    this.name = "ActionError"
    this.code = code
  }
}

export function isActionError(error: unknown): error is ActionError {
  return error instanceof Error && (error as unknown as Record<symbol, unknown>)[actionErrorBrand] === true
}

export type ActionSuccess<T> = { $action: typeof ACTION_RESULT_BRAND; ok: true; data: T }
export type ActionFailure = { $action: typeof ACTION_RESULT_BRAND; ok: false; error: string; code: string }
export type ActionResult<T> = ActionSuccess<T> | ActionFailure

export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { $action: ACTION_RESULT_BRAND, ok: true, data }
}
export function actionFailure(error: string, code = "ACTION_REFUSED"): ActionFailure {
  return { $action: ACTION_RESULT_BRAND, ok: false, error, code }
}

export function isActionResult(value: unknown): value is ActionResult<unknown> {
  return !!value && typeof value === "object" && (value as { $action?: unknown }).$action === ACTION_RESULT_BRAND
}

/** A message written for people. `userMessage` shows these and nothing else. */
export class UserFacingError extends Error {
  readonly userFacing = true as const
  readonly code: string
  constructor(message = "", code = "USER_FACING") {
    super(message)
    this.name = "UserFacingError"
    this.code = code
  }
}

// `any` (an untyped action) stays `any` instead of collapsing to `unknown`.
export type Unwrapped<T> = 0 extends (1 & T) ? T : T extends ActionSuccess<infer D> ? D : T extends ActionFailure ? never : T

/** Returns the data of a successful result, throws a `UserFacingError` for a
 * failed one, and passes any other value (an unconverted action, a demo
 * implementation) through unchanged. */
export function unwrapAction<T>(value: T): Unwrapped<T> {
  if (!isActionResult(value)) return value as Unwrapped<T>
  if (value.ok) return value.data as Unwrapped<T>
  throw new UserFacingError(value.error, value.code)
}

/** A client-side binding of a Server Action that unwraps its result. */
export function unwrapped<A extends unknown[], R>(action: (...args: A) => Promise<R>): (...args: A) => Promise<Unwrapped<Awaited<R>>> {
  return async (...args: A) => unwrapAction(await action(...args))
}

/**
 * Runs a Server Action body and returns its outcome as a value. An `ActionError`
 * becomes a failure result carrying its safe message; every other error,
 * including `redirect()`/`notFound()` and Prisma or Supabase failures, is
 * rethrown so the client shows its own fallback.
 *
 * Returned refusals no longer reach Next's error reporting, so each one is
 * logged at info level with only the action name and code. The message is not
 * logged: it can name people, clubs or applicants.
 */
export async function actionResult<T>(work: () => Promise<T>, action: string): Promise<ActionResult<T>> {
  try {
    return actionSuccess(await work())
  } catch (error) {
    if (!isActionError(error)) throw error
    console.info(JSON.stringify({ event: "action.refused", action, code: error.code }))
    return actionFailure(error.message, error.code)
  }
}
