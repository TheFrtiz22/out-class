/** Errors React error boundaries catch never reach global handlers, so boundaries report them here. */
export function reportClientError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  // A digest means the server failed and onRequestError already reported it.
  if (error && typeof error === "object" && "digest" in error && error.digest) return
  void import("@sentry/nextjs").then(Sentry => { Sentry.captureException(error) }).catch(() => {})
}
