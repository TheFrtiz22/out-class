"use client"

import { InterviewReadScope } from "@/components/interviews/interview-read-scope"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import { CalendarDays, DoorOpen, ListChecks } from "@/components/icons"
import { TERMS } from "@/lib/copy/terms"
import { Button } from "@/components/ui/button"
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
  // Organizers get tabs. Someone who only interviews sees My interviews and nothing to learn.
  const organizer = canSchedule || canManageGrants || capabilities.editKit
  const canOpenSchedule = (canSchedule || canManageGrants) && !settingsOnly
  const allowedTabs = [...(canEnter && !settingsOnly ? ["rooms"] : []), ...(canOpenSchedule ? ["schedule"] : []), "kits"]
  // Interviewer access now lives in Schedule; old links to the Interviewers tab still land on it.
  const requested = initialTab === "availability" || initialTab === "access" ? "schedule" : initialTab
  const fallbackTab = canEnter && !settingsOnly ? "rooms" : canOpenSchedule ? "schedule" : "kits"
  const nextTab = requested && allowedTabs.includes(requested) ? requested : initialTab === "access" && canManageGrants ? "kits" : fallbackTab
  const [tab, setTab] = useState(nextTab)
  const scheduler = useRef<HTMLDivElement>(null)
  const [scheduleVisited, setScheduleVisited] = useState(tab === "schedule")
  useEffect(() => {
    setTab(nextTab)
    if (nextTab === "schedule") setScheduleVisited(true)
  }, [nextTab])
  function select(value: string) {
    if (value === tab || !canLeaveWorkspace(scheduler.current)) return
    setTab(value)
    if (value === "schedule") setScheduleVisited(true)
    if (window.location && window.history) {
      const url = new URL(window.location.href); url.searchParams.set("interviewTab", value)
      window.history.replaceState(null, "", url.pathname + url.search)
    }
  }
  const access = canManageGrants ? <InterviewAccessSetup key={`${clubId}:${initialRoundId ?? ""}`} clubId={clubId} initialRoundId={initialRoundId} /> : null
  return <InterviewReadScope clubId={clubId}><div className="oc-workspace-stack">{settingsOnly && canOpenOperations && <Link href={interviewSetupHref(clubId, initialRoundId, "schedule")} className="inline-flex min-h-11 items-center text-sm underline" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>Open interview schedule</Link>}<Tabs className="oc-interview-management" value={allowedTabs.includes(tab) ? tab : "kits"} onValueChange={select} activationMode="manual">
    {organizer
      ? <TabsList variant="underline" aria-label="Interviews">{canEnter && !settingsOnly && <TabsTrigger value="rooms"><DoorOpen aria-hidden="true" />{TERMS.myInterviewsTab}</TabsTrigger>}{canOpenSchedule && <TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />{TERMS.scheduleTab}</TabsTrigger>}<TabsTrigger value="kits"><ListChecks aria-hidden="true" />{TERMS.questionsTab}</TabsTrigger></TabsList>
      : canEnter && !settingsOnly && <nav aria-label="Interviews" className="flex flex-wrap gap-x-5 text-sm">{tab === "rooms" ? <><Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={() => select("kits")}>View {TERMS.questionsTab.toLowerCase()}</Button><Link href={`/settings/availability?clubId=${encodeURIComponent(clubId)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Set my availability</Link></> : <Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={() => select("rooms")}>Back to {TERMS.myInterviewsTab.toLowerCase()}</Button>}</nav>}
    {organizer && !canSchedule && <Link href={`/settings/availability?clubId=${encodeURIComponent(clubId)}`} className="inline-flex min-h-11 items-center text-sm underline">Set my availability</Link>}
    {canEnter && !settingsOnly && <TabsContent value="rooms"><InterviewRoomsList clubId={clubId} onSchedule={canOpenSchedule ? () => select("schedule") : undefined} /></TabsContent>}
    {canOpenSchedule && (scheduleVisited || tab === "schedule") && <TabsContent ref={scheduler} value="schedule" forceMount hidden={tab !== "schedule"}>{canSchedule ? <RoomManager clubId={clubId} active={tab === "schedule"} interviewerAccess={access} /> : access}</TabsContent>}
    <TabsContent value="kits"><ClubInterviewKitSettings key={`${clubId}:${initialRoundId ?? ""}`} clubId={clubId} initialRoundId={initialRoundId} />{settingsOnly && access}</TabsContent>
  </Tabs></div></InterviewReadScope>
}
