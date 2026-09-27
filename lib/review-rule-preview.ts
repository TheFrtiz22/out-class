/** Pure preview contract. No persistence or applicant/status mutations. */
export const reviewMetrics = {
  gpa: { label: "GPA", min: 0, max: 4, step: 0.01 },
  sat: { label: "SAT", min: 400, max: 1600, step: 10 },
  act: { label: "ACT", min: 1, max: 36, step: 1 },
} as const
export type ReviewMetric = keyof typeof reviewMetrics
export type ReviewThresholds = Partial<Record<ReviewMetric, number>>
export function previewThresholds(thresholds: ReviewThresholds, scores: ReviewThresholds) {
  return (Object.keys(reviewMetrics) as ReviewMetric[]).flatMap(metric => {
    const threshold = thresholds[metric]
    if (threshold === undefined) return []
    const range = reviewMetrics[metric], score = scores[metric]
    const valid = (value: number) => Number.isFinite(value) && value >= range.min && value <= range.max && (metric === "gpa" || Number.isInteger(value))
    return [{ metric, result: !valid(threshold) || (score !== undefined && !valid(score)) ? "invalid" : score === undefined ? "missing" : score < threshold ? "below" : "meets" }]
  })
}
