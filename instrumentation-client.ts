import { sentryOptions } from "@/lib/sentry-scrub"

// NEXT_PUBLIC_ values are inlined at build time: without a DSN this branch is
// removed and the reporting SDK adds nothing to any page. With one, the SDK
// loads in its own chunk after the page starts.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs")
    .then(Sentry => Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_VERCEL_ENV)))
    .catch(() => {})
}
