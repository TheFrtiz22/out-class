"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import { CalendarDays, ListChecks } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { RoomManager } from "@/components/interviews/room-manager"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { interviewCapabilities } from "@/lib/interview-access"
import { InterviewResumeModeration } from "@/components/interview-resume-moderation"
import { InterviewSubmittedReviews } from "@/components/interview-submitted-reviews"
import { InterviewAccessSetup } from "@/components/interview-access-setup"
import "@/components/clubs/interview-kit-editor.css"

export function InterviewManagementTabs({ clubId, initialTab }: { clubId: string; initialTab?: string; onInterview?: () => void }) {
  const { user } = useAuth()
  const canSchedule = hasPermission(user?.memberships.find(m => m.clubId === clubId), "interviews.manage")
  const canModerate = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).moderateResume
  const canReadClosing = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).readClosing
  const canManageGrants = interviewCapabilities(user?.memberships.find(m => m.clubId === clubId)).manageGrants
  const [tab, setTab] = useState(initialTab || (canSchedule ? "schedule" : "kits"))
  return <Tabs className="oc-interview-management" value={tab} onValueChange={value => { if (value !== tab && canLeaveWorkspace()) setTab(value) }} activationMode="manual">
    <TabsList aria-label="Interview management"><TabsTrigger value="kits"><ListChecks aria-hidden="true" />Interview master kit</TabsTrigger>{canSchedule && <TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />Rooms & Booking</TabsTrigger>}{canModerate && <TabsTrigger value="resumes">Résumé moderation</TabsTrigger>}{canReadClosing && <TabsTrigger value="reviews">Submitted reviews</TabsTrigger>}{canManageGrants && <TabsTrigger value="access">Interview access setup</TabsTrigger>}</TabsList>
    <TabsContent value="kits"><ClubInterviewKitSettings clubId={clubId} /></TabsContent>
    {canSchedule && <TabsContent value="schedule"><RoomManager clubId={clubId} /></TabsContent>}
    {canModerate && <TabsContent value="resumes"><InterviewResumeModeration clubId={clubId} /></TabsContent>}
    {canReadClosing && <TabsContent value="reviews"><InterviewSubmittedReviews clubId={clubId} /></TabsContent>}
    {canManageGrants && <TabsContent value="access"><InterviewAccessSetup clubId={clubId} /></TabsContent>}
  </Tabs>
}
