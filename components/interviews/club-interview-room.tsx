"use client"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { hasPermission, hasWorkspace } from "@/lib/permissions"
import { interviewListHref } from "@/lib/interview-entry"
import { ApplicationStateProvider } from "@/lib/application-state"
import { RecruitmentFocus } from "@/components/recruitment-focus"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { PageHeader } from "@/components/ui/page-header"
import { useFocusFrame } from "@/components/shell/focus-frame-context"

const InterviewWorkspaceView = dynamic(() => import("@/components/views/interview-workspace-view").then(m => m.InterviewWorkspaceView), { loading: () => <WorkspaceLoading label="Preparing interview workspace…" layout="interview" rows={3} /> })

/** The interview room route: the club's interview workspace inside the focus frame. */
export function ClubInterviewRoom({ clubId }: { clubId: string }) {
  const router = useRouter(), params = useSearchParams()
  const { user, loading, activeClubId, selectClub } = useAuth(), demo = useDemoMode()
  const membership = user?.memberships.find(member => member.clubId === clubId)
  const back = interviewListHref(clubId, params.toString())
  // Legacy recruitment components share a selected club; select this one before mounting them.
  const needsSelection = !!membership && hasWorkspace(membership) && (activeClubId !== clubId || (demo.isDemoEnabled && demo.state?.perspective.role !== "leader"))
  useEffect(() => { if (needsSelection) selectClub(clubId) }, [clubId, needsSelection, selectClub])
  useFocusFrame({ exitHref: back, club: membership ? { name: membership.club.name, color: membership.club.color } : null })
  if (!demo.ready || loading || needsSelection) return <WorkspaceLoading label="Preparing interview workspace…" layout="interview" rows={3} />
  // The server page also refuses a suspended club; this covers suspension seen after load.
  if (!demo.isDemoEnabled && membership?.club.suspendedAt) return <div className="space-y-4 p-[var(--oc-space-page)]"><PageHeader title="This club is suspended" description="Club operations are unavailable until an administrator restores it. Your membership and existing records are preserved." /><Link className="underline" href="/home">Return to Personal workspace</Link></div>
  if (!membership || !hasPermission(membership, "applications.review")) return <div className="space-y-4 p-[var(--oc-space-page)]"><PageHeader title="Interview room unavailable" description={user ? "You need a current club role with interview access to open this room." : "Sign in with your club account to open this interview room."} /><Link className="underline" href={membership ? back : "/home"}>{membership ? "Back to interviews" : "Return to OutClass"}</Link></div>
  return <ApplicationStateProvider initialData={{ applications: [], attendances: [] }} persistLocalState={false}>
    <RecruitmentFocus />
    <InterviewWorkspaceView key={`${clubId}:${params.get("applicationId") || ""}:${params.get("roundId") || ""}:${params.get("bookingId") || ""}`} scoped onExit={() => router.push(back)} />
  </ApplicationStateProvider>
}
