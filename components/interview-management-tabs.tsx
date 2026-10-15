"use client"

import Link from "next/link"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import { CalendarDays, ListChecks } from "@/components/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { RoomManager } from "@/components/interviews/room-manager"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { interviewCapabilities } from "@/lib/interview-access"
import { InterviewResumeModeration } from "@/components/interview-resume-moderation"
import { InterviewSubmittedReviews } from "@/components/interview-submitted-reviews"
import { InterviewAccessSetup } from "@/components/interview-access-setup"
import "@/components/clubs/interview-kit-editor.css"

export function InterviewManagementTabs({ clubId, initialTab, initialRoundId }: { clubId: string; initialTab?: string; initialRoundId?: string; onInterview?: () => void }) {
  const { user } = useAuth()
  const canSchedule = hasPermission(user?.memberships.find(m => m.clubId === clubId), "interviews.manage")
  const canModerate = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).moderateResume
  const canReadClosing = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).readClosing
  const canManageGrants = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).manageGrants
  const allowedTabs = ["kits", ...(canSchedule ? ["schedule"] : []), ...(canModerate ? ["resumes"] : []), ...(canReadClosing ? ["reviews"] : []), ...(canManageGrants ? ["access"] : [])]
  const requested = initialTab === "availability" ? "schedule" : initialTab
  const [tab, setTab] = useState(requested && allowedTabs.includes(requested) ? requested : canSchedule ? "schedule" : "kits")
  return <div className="space-y-3">{!canSchedule && <Link href={`/settings/availability?clubId=${encodeURIComponent(clubId)}`} className="inline-flex min-h-11 items-center text-sm underline">Set My Availability</Link>}<Tabs className="oc-interview-management" value={allowedTabs.includes(tab) ? tab : "kits"} onValueChange={value => {
    if (value !== tab && canLeaveWorkspace()) {
      setTab(value)
      if (window.location && window.history) {
        const url = new URL(window.location.href); url.searchParams.set("interviewTab", value)
        window.history.replaceState(null, "", url.pathname + url.search)
      }
    }
  }} activationMode="manual">
    <TabsList aria-label="Interview management"><TabsTrigger value="kits"><ListChecks aria-hidden="true" />Interview master kit</TabsTrigger>{canSchedule && <><TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />Scheduling</TabsTrigger></>}{canModerate && <TabsTrigger value="resumes">Résumé moderation</TabsTrigger>}{canReadClosing && <TabsTrigger value="reviews">Submitted reviews</TabsTrigger>}{canManageGrants && <TabsTrigger value="access">Interview access setup</TabsTrigger>}</TabsList>
    <TabsContent value="kits"><ClubInterviewKitSettings clubId={clubId} initialRoundId={initialRoundId} /></TabsContent>
    {canSchedule && <TabsContent value="schedule" forceMount hidden={tab !== "schedule"}><RoomManager clubId={clubId} /></TabsContent>}
    {canModerate && <TabsContent value="resumes"><InterviewResumeModeration clubId={clubId} /></TabsContent>}
    {canReadClosing && <TabsContent value="reviews"><InterviewSubmittedReviews clubId={clubId} /></TabsContent>}
    {canManageGrants && <TabsContent value="access"><InterviewAccessSetup clubId={clubId} /></TabsContent>}
  </Tabs></div>
}
