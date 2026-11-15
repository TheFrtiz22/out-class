"use client"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useCorkboard } from "@/contexts/corkboard-context"
import { getClubDirectory } from "@/lib/workspace-api"
import { suggestClubs, type ClubSuggestion } from "@/lib/club-suggestions"
import type { DirectoryClub } from "@/lib/club-directory"
import { useInterestSurvey } from "@/hooks/use-interest-survey"

/**
 * Suggestions from the clubs a student saved, their own club-interest survey answers (private; read
 * only by their own session) and the major on their profile. Saved clubs and
 * clubs they already belong to are never suggested. `directory` is the public directory the
 * page already holds; pages without one (Home) pass `null` and it is read once, cached server-side.
 */
export function useSuggestedClubs(directory: readonly DirectoryClub[] | null, limit = 6) {
  const { user } = useAuth()
  const { items, loading: savedLoading } = useCorkboard()
  const major = user?.profile?.major ?? null
  const { survey } = useInterestSurvey()
  const hasSignal = items.length > 0 || !!major?.trim() || !!survey?.interests.length || !!survey?.goals.length
  const [fetched, setFetched] = useState<DirectoryClub[] | null>(null)
  useEffect(() => {
    if (directory || !hasSignal || fetched) return
    let live = true
    getClubDirectory().then(result => { if (live) setFetched(result.clubs ?? []) }).catch(() => { if (live) setFetched([]) })
    return () => { live = false }
  }, [directory, hasSignal, fetched])
  const clubs = directory ?? fetched
  const memberIds = useMemo(() => user?.memberships?.filter(m => m.status === "ACTIVE").map(m => m.clubId) ?? [], [user])
  const suggestions = useMemo<ClubSuggestion[]>(
    () => clubs && hasSignal ? suggestClubs(clubs, { saved: items.map(item => item.club), major, survey, exclude: memberIds }, limit) : [],
    [clubs, hasSignal, items, major, survey, memberIds, limit],
  )
  return { suggestions, hasSignal, loading: savedLoading || (hasSignal && !clubs), savedCount: items.length }
}
