import { UserFacingError } from "@/lib/action-result";
// Shared by server actions and their client callers: production masks thrown
// server-action messages, so contention is returned as a typed result instead.

/** Retries ran out because other writers kept winning the same rows. */
export const TRANSACTION_CONFLICT_MESSAGE = "Someone else just changed this. Try again.";
/** A lock or transaction timeout: the database was busy, nothing was saved. */
export const WRITE_TIMEOUT_MESSAGE = "This is taking longer than usual. Try again in a moment.";

export type ContentionFailure = { ok: false; contention: "conflict" | "timeout"; error: string };

export function isContentionFailure(value: unknown): value is ContentionFailure {
  return !!value && typeof value === "object" && (value as { ok?: unknown }).ok === false && typeof (value as { contention?: unknown }).contention === "string" && typeof (value as { error?: unknown }).error === "string";
}

/** Client side: turn a returned contention failure back into an error carrying its real wording. */
export function unwrapContention<T>(value: T | ContentionFailure): T {
  if (isContentionFailure(value)) throw new UserFacingError(value.error);
  return value as T;
}
