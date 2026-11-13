"use client"

import { useReportWebVitals } from "next/web-vitals"
import { sampleWebVitals, webVitalMetric } from "@/lib/web-vitals"

// One sampling decision and one route per page load: Core Web Vitals describe the document that
// loaded, and CLS/INP arrive later (when the tab is hidden), possibly after client navigations.
const sampled = typeof window !== "undefined" && sampleWebVitals(process.env.NEXT_PUBLIC_VERCEL_ENV)
const landing = typeof window !== "undefined" ? window.location.pathname : "/"

// Stable module-level callback, as useReportWebVitals requires. The SDK chunk is the one
// instrumentation-client.ts loads; before Sentry.init there is no client and the value is dropped.
function report(metric: { name: string; value: number; rating?: string }) {
  if (!sampled) return
  const vital = webVitalMetric(metric, landing)
  if (!vital) return
  void import("@sentry/nextjs")
    .then(Sentry => Sentry.metrics.distribution(vital.name, vital.value, { ...(vital.unit ? { unit: vital.unit } : {}), attributes: vital.attributes }))
    .catch(() => {})
}

/** Core Web Vitals by route template into Sentry metrics. Mounted only when a Sentry DSN is configured. */
export function WebVitalsReporter() {
  useReportWebVitals(report)
  return null
}
