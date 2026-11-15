"use client"
import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getMyInterestSurvey } from "@/lib/workspace-api"
import type { InterestSurveyDocument } from "@/lib/interest-survey"

/**
 * The signed-in student's own survey answers, read once per account and shared by every component on
 * the page (Home prompt, suggestions, Settings), so a save shows up everywhere without a reload.
 * Off in Demo Mode and support (view-as) sessions: the answers are private and never read there.
 */
type Entry = { userId: string; survey: InterestSurveyDocument | null; loaded: boolean }
let entry: Entry | null = null
let pending: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => entry

function load(userId: string) {
  if (pending === userId) return
  pending = userId
  getMyInterestSurvey()
    .then(survey => { if (pending === userId) { entry = { userId, survey, loaded: true }; emit() } })
    // Suggestions simply fall back to saved clubs and major; nothing is shown about the failure.
    .catch(() => { if (pending === userId) { entry = { userId, survey: null, loaded: true }; emit() } })
    .finally(() => { if (pending === userId) pending = null })
}

/** Forget the cached answers (after a save from a component without the hook): the next reader re-reads them. */
export function invalidateInterestSurvey() { entry = null; pending = null; emit() }

export function useInterestSurvey() {
  const { user, isImpersonating } = useAuth()
  const demo = useDemoMode()
  const userId = user?.id ?? null
  const enabled = !!userId && !isImpersonating && !demo.isDemoEnabled
  const current = useSyncExternalStore(subscribe, snapshot, () => null)
  useEffect(() => { if (enabled && userId && current?.userId !== userId) load(userId) }, [enabled, userId, current?.userId])
  const mine = enabled && current?.userId === userId ? current : null
  const update = useCallback((survey: InterestSurveyDocument) => { if (userId) { entry = { userId, survey, loaded: true }; emit() } }, [userId])
  return { enabled, survey: mine?.survey ?? null, loaded: !enabled || !!mine?.loaded, update }
}
