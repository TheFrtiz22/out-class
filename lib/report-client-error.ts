/** Errors React error boundaries catch never reach global handlers, so boundaries report them here. */
export function reportClientError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  void import("@sentry/nextjs").then(Sentry => { Sentry.captureException(error) }).catch(() => {})
}
