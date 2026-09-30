"use client"

import { useState } from "react"
import { CalendarDays, ListChecks } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { RoomManager } from "@/components/interviews/room-manager"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import "@/components/clubs/interview-kit-editor.css"

export function InterviewManagementTabs({ clubId }: { clubId: string; onInterview: () => void }) {
  const [tab, setTab] = useState("schedule")
  return <Tabs className="oc-interview-management" value={tab} onValueChange={value => { if (value !== tab && canLeaveWorkspace()) setTab(value) }} activationMode="manual">
    <TabsList aria-label="Interview management"><TabsTrigger value="kits"><ListChecks aria-hidden="true" />Interview Kits</TabsTrigger><TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />Rooms & Booking</TabsTrigger></TabsList>
    <TabsContent value="kits"><ClubInterviewKitSettings clubId={clubId} /></TabsContent>
    <TabsContent value="schedule"><RoomManager clubId={clubId} /></TabsContent>
  </Tabs>
}
