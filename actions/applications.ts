"use server"
import { ownPanelAssignments } from "@/utils/official-panel-schedule"

import { assertClubOperational } from "@/lib/club-suspension";
import { activeRecruitmentCycle, applicationRecency, currentApplication, reapplicationUnavailable } from "@/lib/recruitment-cycle";
import { publicMeetingVisibility } from "@/lib/campus-events";

import { applicationAvailability } from "@/lib/club-settings"
import { meetsTestRequirement } from "@/lib/test-scores"
import { ALUMNI_APPLY_MESSAGE, isAlumniProfile } from "@/lib/graduation"
import { activeMemberWhere } from "@/lib/permissions"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { revalidatePath } from "next/cache"
import { applicationInputSchema, applicationAnswersKey, answerErrors, normalizeApplicationAttachments, assertApplicationAttachmentOwnership } from "@/lib/student-applications"
import type { z } from "zod"
import { boundedParse } from "@/lib/bounded-input"
import { ActionError, actionResult } from "@/lib/action-result"

async function persistApplication(input: z.infer<typeof applicationInputSchema>, submit: boolean) {
  const { user } = await requireAuth()
  const parsed = boundedParse(applicationInputSchema, input)
  const { clubWriteTransaction } = await import("@/utils/club-write-transaction")
  const applicationId = await clubWriteTransaction(async (tx) => {
    // FOR SHARE (not FOR UPDATE) on the club: leader configuration changes,
    // decisions and suspension still serialize against this save, but different
    // students' autosaves no longer queue behind one club-wide lock. The student
    // row lock keeps one student's concurrent tabs ordered for the unique
    // (studentId, clubId) application.
    await assertClubOperational(tx, parsed.clubId)
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    const configuration = await tx.club.findUnique({ where: { id: parsed.clubId }, select: { applicationOpen: true, applicationDeadline: true, testRequirement: true } })
    if (!configuration || submit && !applicationAvailability(configuration)) throw new ActionError("Applications are closed for this club. Your saved draft is retained.")
    if (submit) {
      const profile = await tx.studentProfile.findUnique({ where: { userId: user.id } })
      if (!profile) throw new ActionError("You must complete your unified profile before applying.")
      // Alumni keep drafts and history but cannot submit (lib/graduation.ts).
      if (isAlumniProfile(profile)) throw new ActionError(ALUMNI_APPLY_MESSAGE)
      if (!meetsTestRequirement(configuration.testRequirement, profile)) throw new ActionError("Update your profile to meet this club's SAT/ACT requirement before submitting.")
    }
    const questions = await tx.applicationQuestion.findMany({ where: { clubId: parsed.clubId, archivedAt: null } })
    parsed.answers = normalizeApplicationAttachments(questions, parsed.answers)
    assertApplicationAttachmentOwnership(questions, parsed.answers, user.id)
    const errors = answerErrors(questions, parsed.answers, submit)
    if (Object.keys(errors).length) throw new ActionError(Object.values(errors)[0])
    const firstRound = await tx.pipelineRound.findFirst({
      where: { clubId: parsed.clubId, archivedAt: null },
      orderBy: { order: "asc" },
    })
    if (!firstRound) throw new ActionError("This club has not set up their application pipeline yet.")
    const existing = await currentApplication(tx, user.id, parsed.clubId)
    // Submissions join the club's single active recruitment cycle; a new
    // application after a rejection is only allowed in a different cycle.
    const activeCycle = submit || !existing ? await activeRecruitmentCycle(tx, parsed.clubId) : null
    if (!existing) {
      const unavailable = await reapplicationUnavailable(tx, user.id, parsed.clubId, activeCycle)
      if (unavailable) throw new ActionError(unavailable)
    }
    if (existing && parsed.expectedAnswers !== undefined) {
      const current = await tx.applicationAnswer.findMany({ where: { applicationId: existing.id }, select: { questionId: true, response: true } })
      const key = applicationAnswersKey(current)
      if (key !== parsed.expectedAnswers && key !== applicationAnswersKey(parsed.answers))
        throw new ActionError("This application changed in another tab. Your responses are retained. Reopen it to compare before saving.")
    }
    const cycle = submit && !existing?.recruitmentCycleId && activeCycle ? { recruitmentCycleId: activeCycle.id } : {}
    const transition = submit
      ? { status: "SUBMITTED" as const, roundId: firstRound.id, submittedAt: new Date(), ...cycle }
      : { status: "DRAFTING" as const }
    if (existing) {
      // The status predicate also protects against a save racing with submission.
      const result = await tx.application.updateMany({
        where: { id: existing.id, studentId: user.id, status: "DRAFTING" },
        data: transition,
      })
      if (result.count !== 1)
        throw new ActionError(
          "This application has already been submitted. Reload to see its current status.",
        )
      await tx.applicationAnswer.deleteMany({ where: { applicationId: existing.id } })
      if (parsed.answers.length)
        await tx.applicationAnswer.createMany({
          data: parsed.answers.map((answer) => ({ ...answer, applicationId: existing.id })),
        })
      return existing.id
    }
    const application = await tx.application.create({
      data: {
        studentId: user.id,
        clubId: parsed.clubId,
        roundId: firstRound.id,
        ...transition,
        answers: { create: parsed.answers },
      },
    })
    return application.id
  })
  revalidatePath("/", "layout")
  revalidatePath(`/club/${parsed.clubId}`)
  return { success: true, applicationId }
}

export async function submitApplication(data: z.infer<typeof applicationInputSchema>) {
  return actionResult(() => persistApplication(data, true), "submitApplication")
}
export async function saveApplicationDraft(data: z.infer<typeof applicationInputSchema>) {
  return actionResult(() => persistApplication(data, false), "saveApplicationDraft")
}

export async function getStudentApplications() {
  const { user } = await requireAuth()
  const applications = await prisma.application.findMany({
    where: { studentId: user.id },
    select: {
      id: true,
      clubId: true,
      status: true,
      submittedAt: true,
      recruitmentOffer: { select: { status: true, expiresAt: true } },
      decisionLetters: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      club: {
        select: {
          applicationOpen: true,
          applicationDeadline: true,
          testRequirement: true,
          name: true,
          logoUrl: true,
          marketing: true,
          color: true,
          pipelineRounds: { where: { archivedAt: null }, select: { id: true, name: true, order: true }, orderBy: { order: "asc" } },
          questions: {
            select: { id: true, prompt: true, type: true, required: true, wordLimit: true, options: true, showIf: true, archivedAt: true },
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
        },
      },
      round: { select: { id: true, name: true, order: true } },
      answers: { select: { questionId: true, response: true } },
      bookings: {
        select: { id: true, roundId: true, slot: { select: { startTime: true, endTime: true, location: true } } },
        orderBy: { slot: { startTime: "asc" } },
      },
    },
    orderBy: applicationRecency,
  })
  return applications.map(app => ({ ...app, club: { ...app.club, questions: app.club.questions.filter(q => !q.archivedAt || app.status !== "DRAFTING" && app.answers.some(a => a.questionId === q.id)) } }))
}

// The student calendar shows upcoming meetings plus one semester of history.
// Older meetings the student attended still appear through `attendances`.
const STUDENT_CALENDAR_HISTORY_MS = 180 * 24 * 3600000
function studentCalendarWindow() {
  const since = new Date(Date.now() - STUDENT_CALENDAR_HISTORY_MS)
  return { OR: [{ date: { gte: since } }, { endDate: { gte: since } }] }
}

export async function getStudentDashboardData() {
  const { user } = await requireAuth()

  const [applications, attendances, meetings, panelAssignments] = await Promise.all([
prisma.application.findMany({
    where: { studentId: user.id },
    omit: { anonymousReviewText: true },
    include: {
      club: {
        select: { name: true, logoUrl: true, marketing: true, color: true, _count: { select: { questions: true } } },
      },
      round: {
        select: { name: true },
      },
      answers: true,
      bookings: {
        include: { slot: true },
      },
    },
    orderBy: applicationRecency,
  }),

prisma.eventAttendance.findMany({
    where: { studentId: user.id, event: { OR: [publicMeetingVisibility, { club: { members: { some: { userId: user.id, ...activeMemberWhere } } } }] } },
    include: {
      event: {
        include: { club: { select: { name: true } } },
      },
    },
  }),

prisma.meeting.findMany({ where: { AND: [{ OR: [publicMeetingVisibility, { club: { members: { some: { userId: user.id, ...activeMemberWhere } } } }] }, studentCalendarWindow()] }, select: { id: true, clubId: true, title: true, date: true, endDate: true, allDay: true, location: true, description: true, audience: true, club: { select: { name: true } } }, orderBy: { date: "asc" } }),
prisma.$transaction(tx=>ownPanelAssignments(tx,user.id))
  ])
  return { applications, attendances, meetings, panelAssignments }
}
