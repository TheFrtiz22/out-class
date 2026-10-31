export const APPLICANT_PAGE_SIZE = 100

/** Display boundary only: callers retain the complete filtered selection. */
export function applicantPage<T>(applicants: readonly T[], requested: number) {
  const count = Math.max(1, Math.ceil(applicants.length / APPLICANT_PAGE_SIZE))
  const page = Math.max(0, Math.min(count - 1, Math.trunc(requested) || 0))
  const start = page * APPLICANT_PAGE_SIZE
  return { page, count, start, items: applicants.slice(start, start + APPLICANT_PAGE_SIZE) }
}
