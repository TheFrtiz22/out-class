import { routeTemplate, type RouteTemplate } from "@/lib/route-template"

/** Core Web Vitals sent to Sentry, by the metric names Next.js reports. */
const VITALS = { LCP: "millisecond", INP: "millisecond", FCP: "millisecond", TTFB: "millisecond", CLS: "" } as const
export type VitalName = keyof typeof VITALS

/**
 * Share of production page loads whose vitals are sent. Decided once per page load, so a sampled
 * load reports all of its vitals together. Previews and development send nothing. `environment` is
 * the one the Sentry SDK was initialized with (sentryOptions), not a separate env read.
 */
export const WEB_VITALS_SAMPLE_RATE = 0.5

export function sampleWebVitals(environment: string | undefined, random = Math.random()) {
  return environment === "production" && random < WEB_VITALS_SAMPLE_RATE
}

export type WebVitalMetric = { name: string; value: number; unit?: "millisecond"; attributes: { route: RouteTemplate; rating?: string } }

/**
 * One Sentry distribution for a reported vital: `web_vital.lcp` etc., tagged with the route template
 * of the page shown when the vital is reported (never the URL, IDs or query) and the vital's rating.
 * Anything else is null.
 */
export function webVitalMetric(metric: { name: string; value: number; rating?: string }, pathname: string): WebVitalMetric | null {
  if (!(metric.name in VITALS) || !Number.isFinite(metric.value) || metric.value < 0) return null
  const unit = VITALS[metric.name as VitalName]
  const rating = metric.rating && ["good", "needs-improvement", "poor"].includes(metric.rating) ? metric.rating : undefined
  return {
    name: `web_vital.${metric.name.toLowerCase()}`,
    value: metric.value,
    ...(unit ? { unit } : {}),
    attributes: { route: routeTemplate(pathname), ...(rating ? { rating } : {}) },
  }
}
