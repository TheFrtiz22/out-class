// Without NEXT_PUBLIC_SENTRY_DSN nothing here runs and nothing is downloaded: the
// SDK and the privacy filter live in their own chunks, fetched only when a DSN is
// configured, after the page starts.
let sdk: typeof import("@sentry/nextjs") | undefined
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry-scrub")])
    .then(([Sentry, { sentryOptions }]) => {
      Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_VERCEL_ENV))
      sdk = Sentry
    })
    .catch(() => {})
}

/** Times client-side navigations once the SDK has loaded; a no-op before then and without a DSN. */
export function onRouterTransitionStart(href: string, navigationType: string) {
  sdk?.captureRouterTransitionStart(href, navigationType)
}
