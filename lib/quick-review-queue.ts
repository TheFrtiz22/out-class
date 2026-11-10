/** Use only the freshly authorized selection; retain the user's queue order. */
export function nextQuickReviewApplicant<T extends { id: string; canQuickReview?: boolean }>(remaining: readonly string[], selection: readonly T[]): T | undefined {
  const byId = new Map<string, T>();
  for (const applicant of selection) {
    const id = applicant.id;
    if (!byId.has(id)) byId.set(id, applicant);
  }
  for (const id of remaining) {
    const applicant = byId.get(id);
    if (applicant?.canQuickReview) return applicant;
  }
}
