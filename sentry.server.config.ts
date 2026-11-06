import * as Sentry from "@sentry/nextjs"
import { sentryOptions } from "@/lib/sentry-scrub"

// Loaded by instrumentation.ts only when a DSN is configured.
Sentry.init(sentryOptions(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.VERCEL_ENV, "server"))
