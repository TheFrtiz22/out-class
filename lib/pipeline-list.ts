import type { getClubPipeline } from "@/actions/crm"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>

/** Relation plans may return visible references in different orders. Preserve
 * multiplicity while making the narrow contract independent of SQL row order. */
export function pipelineReviewerReferences(reviews: readonly { interviewerId: string }[]) {
  return reviews.map(review => ({ interviewerId: review.interviewerId })).sort((a, b) =>
    a.interviewerId < b.interviewerId ? -1 : a.interviewerId > b.interviewerId ? 1 : 0)
}

/** Run only after the canonical per-applicant privacy and score projection. */
export function pipelineListProjection(data: Pipeline) {
  return {
    rounds: data.rounds,
    genderCounts: data.genderCounts,
    applications: data.applications.map(app => {
      const profile = app.student.studentProfile
      return {
        id: app.id, roundId: app.roundId, status: app.status, studentId: app.studentId,
        student: {
          email: app.student.email,
          studentProfile: profile ? {
            firstName: profile.firstName, lastName: profile.lastName, major: profile.major,
            academicYear: profile.academicYear, gpa: profile.gpa,
            satScore: profile.satScore, actScore: profile.actScore,
          } : null,
        },
        evaluations: pipelineReviewerReferences(app.evaluations),
        roundScore: app.roundScore,
      }
    }),
  }
}
