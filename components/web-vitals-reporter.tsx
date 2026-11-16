"use client"

import { useReportWebVitals } from "next/web-vitals"
import { sampleWebVitals, webVitalMetric, WEB_VITALS_SAMPLE_RATE } from "@/lib/web-vitals"

// One sampling draw per page load, so a sampled load reports all of its vitals together.
const draw = typeof window !== "undefined" ? Math.random() : 1

// Stable module-level callback, as useReportWebVitals requires. The SDK chunk is the one
// instrumentation-client.ts loads; before Sentry.init there is no client and the value is dropped.
function report(metric: { name: string; value: number; rating?: string }) {
  if (draw >= WEB_VITALS_SAMPLE_RATE) return
  // The route showing when the value is reported: INP and CLS arrive late (when the tab is hidden),
  // often after client navigations, and describe the page the visitor was on, not the first one loaded.
  const vital = webVitalMetric(metric, window.location.pathname)
  if (!vital) return
  void import("@sentry/nextjs")
    .then(Sentry => {
      // Production is decided by the environment the SDK was initialized with (sentryOptions), the
      // same decision that gates performance sampling, rather than a second reading of the env.
      if (!sampleWebVitals(Sentry.getClient()?.getOptions().environment, draw)) return
      Sentry.metrics.distribution(vital.name, vital.value, { ...(vital.unit ? { unit: vital.unit } : {}), attributes: vital.attributes })
    })
    .catch(() => {})
}

/** Core Web Vitals by route template into Sentry metrics. Mounted only when a Sentry DSN is configured. */
export function WebVitalsReporter() {
  useReportWebVitals(report)
  return null
}
