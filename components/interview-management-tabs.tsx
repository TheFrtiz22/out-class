"use client"

import { InterviewReadScope } from "@/components/interviews/interview-read-scope"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import { CalendarDays, ListChecks } from "@/components/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { RoomManager } from "@/components/interviews/room-manager"
import { interviewSetupHref } from "@/lib/interview-setup"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { interviewCapabilities } from "@/lib/interview-access"
import { InterviewAccessSetup } from "@/components/interview-access-setup"
import { InterviewRoomsList } from "@/components/interviews/interview-rooms-list"
import "@/components/clubs/interview-kit-editor.css"

export function InterviewManagementTabs({ clubId, initialTab, initialRoundId, settingsOnly = false }: { clubId: string; initialTab?: string; initialRoundId?: string; settingsOnly?: boolean; onInterview?: () => void }) {
  const { user } = useAuth()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const capabilities = interviewCapabilities(member)
  const canEnter = capabilities.participate
  const canSchedule = hasPermission(member, "interviews.manage")
  const canManageGrants = capabilities.manageGrants
  const canOpenOperations = canSchedule || hasPermission(member, "applications.review") || capabilities.editKit
  const allowedTabs = [...(canEnter && !settingsOnly ? ["rooms"] : []), "kits", ...(canSchedule && !settingsOnly ? ["schedule"] : []), ...(canManageGrants ? ["access"] : [])]
  const requested = initialTab === "availability" ? "schedule" : initialTab
  const nextTab = requested && allowedTabs.includes(requested) ? requested : canEnter && !settingsOnly ? "rooms" : canSchedule && !settingsOnly ? "schedule" : "kits"
  const [tab, setTab] = useState(nextTab)
  const scheduler = useRef<HTMLDivElement>(null)
  const [scheduleVisited, setScheduleVisited] = useState(tab === "schedule")
  useEffect(() => {
    setTab(nextTab)
    if (nextTab === "schedule") setScheduleVisited(true)
  }, [nextTab])
  return <InterviewReadScope clubId={clubId}><div className="oc-workspace-stack">{settingsOnly && canOpenOperations && <Link href={interviewSetupHref(clubId, initialRoundId, "schedule")} className="inline-flex min-h-11 items-center text-sm underline" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Open Interview Scheduling</Link>}{!canSchedule && <Link href={`/settings/availability?clubId=${encodeURIComponent(clubId)}`} className="inline-flex min-h-11 items-center text-sm underline">Set My Availability</Link>}<Tabs className="oc-interview-management" value={allowedTabs.includes(tab) ? tab : "kits"} onValueChange={value => {
    if (value !== tab && canLeaveWorkspace(scheduler.current)) {
      setTab(value)
      if (value === "schedule") setScheduleVisited(true)
      if (window.location && window.history) {
        const url = new URL(window.location.href); url.searchParams.set("interviewTab", value)
        window.history.replaceState(null, "", url.pathname + url.search)
      }
    }
  }} activationMode="manual">
    <TabsList aria-label="Interview management">{canEnter && !settingsOnly && <TabsTrigger value="rooms">Interview rooms</TabsTrigger>}<TabsTrigger value="kits"><ListChecks aria-hidden="true" />Interview master kit</TabsTrigger>{canSchedule && !settingsOnly && <><TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />Scheduling</TabsTrigger></>}{canManageGrants && <TabsTrigger value="access">Interview access setup</TabsTrigger>}</TabsList>
    {canEnter && !settingsOnly && <TabsContent value="rooms"><InterviewRoomsList clubId={clubId} /></TabsContent>}
    <TabsContent value="kits"><ClubInterviewKitSettings key={`${clubId}:${initialRoundId ?? ""}`} clubId={clubId} initialRoundId={initialRoundId} /></TabsContent>
    {canSchedule && !settingsOnly && (scheduleVisited || tab === "schedule") && <TabsContent ref={scheduler} value="schedule" forceMount hidden={tab !== "schedule"}><RoomManager clubId={clubId} active={tab === "schedule"} /></TabsContent>}
    {canManageGrants && <TabsContent value="access"><InterviewAccessSetup key={`${clubId}:${initialRoundId ?? ""}`} clubId={clubId} initialRoundId={initialRoundId} /></TabsContent>}
  </Tabs></div></InterviewReadScope>
}
