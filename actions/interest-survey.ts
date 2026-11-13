"use server"
import { ActionError, actionResult } from "@/lib/action-result"
import { boundedParse } from "@/lib/bounded-input"
import { answeredAny, interestSurveySaveSchema, readInterestAnswers, type InterestSurveyDocument } from "@/lib/interest-survey"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"

/**
 * The club-interest survey. Answers are private to the student: every action reads or writes only the
 * signed-in account's own row (the user id always comes from the session, never from input). A
 * support (view-as) session never sees or changes them, and Demo Mode never reaches here
 * (requireAuth refuses it).
 */
type Row = { interests: string[]; goals: string[]; weeklyHours: string | null; selectivity: string | null; revision: number; completedAt: Date | null; dismissedAt: Date | null }
const select = { interests: true, goals: true, weeklyHours: true, selectivity: true, revision: true, completedAt: true, dismissedAt: true } as const
const SUPPORT_SESSION = "Interest answers are private to the student and unavailable in a support session."
const changed = "Your interests changed in another tab. Reload before saving again."

function present(row: Row | null): InterestSurveyDocument {
  return { ...readInterestAnswers(row), revision: row?.revision ?? 0, completed: !!row?.completedAt, dismissed: !!row?.dismissedAt }
}
async function owner() {
  const { user, impersonation } = await requireAuth()
  if (impersonation) throw new ActionError(SUPPORT_SESSION, "FORBIDDEN")
  return user
}

/** The caller's own answers, or null in a support session (staff never see them). */
export async function getMyInterestSurvey(): Promise<InterestSurveyDocument | null> {
  const { user, impersonation } = await requireAuth()
  if (impersonation) return null
  return present(await prisma.studentInterestProfile.findUnique({ where: { userId: user.id }, select }))
}

async function saveMyInterestSurveyCommand(raw: unknown): Promise<InterestSurveyDocument> {
  const input = boundedParse(interestSurveySaveSchema, raw, { maxArrayLength: 20, maxBytes: 4096 })
  const user = await owner()
  const { revision, ...answers } = input
  const any = answeredAny(answers)
  const now = new Date()
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
    const old = await tx.studentInterestProfile.findUnique({ where: { userId: user.id }, select: { revision: true } })
    if ((old?.revision ?? 0) !== revision) throw new ActionError(changed, "STALE")
    // Clearing every answer also retires the Home prompt: the student chose to answer nothing.
    const state = { ...answers, completedAt: any ? now : null, ...(any ? {} : { dismissedAt: now }) }
    const saved = await tx.studentInterestProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...state, revision: 1 },
      update: { ...state, revision: { increment: 1 } },
      select,
    })
    return present(saved)
  })
}

/** Hides the one-time Home prompt (also used by "Skip" in onboarding). Answers and revision are unchanged. */
async function dismissInterestSurveyPromptCommand(): Promise<InterestSurveyDocument> {
  const user = await owner()
  const saved = await prisma.studentInterestProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
    select,
  })
  return present(saved)
}

export async function saveMyInterestSurvey(...args: Parameters<typeof saveMyInterestSurveyCommand>) {
  return actionResult(() => saveMyInterestSurveyCommand(...args), "saveMyInterestSurvey")
}
export async function dismissInterestSurveyPrompt() {
  return actionResult(() => dismissInterestSurveyPromptCommand(), "dismissInterestSurveyPrompt")
}
