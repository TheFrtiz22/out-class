"use client"

import { useState } from "react"
import { CalendarDays, ListChecks } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ClubInterviewKitSettings } from "@/components/interview-kit-editor"
import { DemoInterviewSchedule } from "@/components/demo-workspace"
import { InterviewSchedulerView } from "@/components/views/interview-scheduler-view"
import { useDemoMode } from "@/contexts/demo-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import "@/components/clubs/interview-kit-editor.css"

export function InterviewManagementTabs({ clubId, onInterview }: { clubId: string; onInterview: () => void }) {
  const demo = useDemoMode()
  const [tab, setTab] = useState("kits")
  return <Tabs className="oc-interview-management" value={tab} onValueChange={value => { if (value !== tab && canLeaveWorkspace()) setTab(value) }} activationMode="manual">
    <TabsList aria-label="Interview management"><TabsTrigger value="kits"><ListChecks aria-hidden="true" />Interview Kits</TabsTrigger><TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />{demo.isDemoEnabled ? "Demo Schedule" : "Scheduling Preview"}</TabsTrigger></TabsList>
    <TabsContent value="kits"><ClubInterviewKitSettings clubId={clubId} /></TabsContent>
    <TabsContent value="schedule">{demo.isDemoEnabled ? <DemoInterviewSchedule onNavigate={onInterview} /> : <><p className="mb-5 text-sm leading-7 text-muted-foreground">Local scheduling preview · these tools do not publish real slots or bookings. Interview kits are saved separately.</p><InterviewSchedulerView onNavigate={onInterview} /></>}</TabsContent>
  </Tabs>
}
