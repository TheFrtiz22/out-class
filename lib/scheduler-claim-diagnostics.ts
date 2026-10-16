type ClaimPhase = "acquisition" | "configuration" | "advisory_lock" | "capacity_scan" | "candidate_scan" | "intent_lock" | "claim_update" | "commit";

/** Constant-size, identifier-free evidence. No SQL, URLs, error text or metadata
 * is retained. This observes existing budgets; it does not retry or extend them. */
export function createSchedulerClaimTrace() {
  const started = Date.now();
  let acquired: number | null = null, stepStarted = started;
  let phase: ClaimPhase = "acquisition";
  const duration = (ms: number) => Math.min(60_000, Math.max(0, Math.round(ms)));
  return {
    enter() { acquired = Date.now(); stepStarted = acquired; phase = "configuration"; },
    step(next: ClaimPhase) { phase = next; stepStarted = Date.now(); },
    snapshot() {
      const now = Date.now();
      return { phase, acquisitionMs: duration((acquired ?? now) - started),
        transactionMs: acquired === null ? null : duration(now - acquired),
        stepMs: duration(now - stepStarted), elapsedMs: duration(now - started) };
    },
  };
}

export function schedulerErrorCodes(error: unknown) {
  let code = "UNKNOWN", sqlState: string | null = null;
  try {
    if (error && typeof error === "object") {
      const value = error as { code?: unknown; meta?: { code?: unknown } };
      if (typeof value.code === "string" && /^P[0-9]{4}$/.test(value.code)) code = value.code;
      // Prisma raw-query errors expose PostgreSQL SQLSTATE as meta.code.
      if (typeof value.meta?.code === "string" && /^[0-9A-Z]{5}$/.test(value.meta.code)) sqlState = value.meta.code;
    }
  } catch { /* hostile getters must not replace the original failure */ }
  return { code, sqlState };
}
