"use client"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"

/** Carries ?applicantId / ?roundId into the shared leader focus for the selected club. */
export function RecruitmentFocus() {
  const params = useSearchParams(), { focusLeader } = useApplicationState()
  const { activeClubId } = useAuth()
  const applicantId = params.get("applicantId"), roundId = params.get("roundId")
  useEffect(() => { if (activeClubId && (applicantId || roundId)) focusLeader({ clubId: activeClubId, ...(applicantId ? { applicantId } : {}), ...(roundId ? { roundId } : {}) }) }, [activeClubId, applicantId, roundId, focusLeader])
  return null
}
