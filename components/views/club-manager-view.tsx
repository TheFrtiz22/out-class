"use client"

import { QrCodeCard } from "@/components/qr/qr-code-card"
import { Users2, ListChecks, Palette, CalendarClock, CalendarPlus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RosterRolesView } from "@/components/views/club-manager/roster-roles-view"
import { ApplicationBuilderView } from "@/components/views/club-manager/application-builder-view"
import { InterviewPipelineBuilderView } from "@/components/views/club-manager/interview-pipeline-builder-view"
import { ProfileBuilder } from "@/components/customization/profile-builder"
import { RecruitmentPipelineBuilder } from "@/components/customization/recruitment-pipeline-builder"
import { EventsMeetingsView } from "@/components/views/club-manager/events-meetings-view"

export function ClubManagerView() {
  return (
    <Tabs defaultValue="roster" className="gap-6">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="roster" className="gap-1.5">
          <Users2 className="size-4" /> Roster & Roles
        </TabsTrigger>
        <TabsTrigger value="builder" className="gap-1.5">
          <ListChecks className="size-4" /> Application Builder
        </TabsTrigger>
        <TabsTrigger value="pipeline" className="gap-1.5">
          <CalendarClock className="size-4" /> Recruitment Pipeline
        </TabsTrigger>
        <TabsTrigger value="events" className="gap-1.5">
          <CalendarPlus className="size-4" /> Events & Meetings
        </TabsTrigger>
        <TabsTrigger value="branding" className="gap-1.5">
          <Palette className="size-4" /> Profile & Branding
        </TabsTrigger>
        <TabsTrigger value="qr">QR Codes & Links</TabsTrigger>
      </TabsList>

      <TabsContent value="qr">
        <QrCodeCard title="Club profile QR code" description="Give your next flyer a direct link to your public OutClass profile." path="/club/vvf/" filename="vvf-club-profile" />
      </TabsContent>
      <TabsContent value="roster">
        <RosterRolesView />
      </TabsContent>
      <TabsContent value="builder">
        <ApplicationBuilderView />
      </TabsContent>
      <TabsContent value="pipeline">
        <div className="space-y-6"><RecruitmentPipelineBuilder /><details className="rounded-xl border border-neutral-200 bg-white p-5"><summary className="cursor-pointer text-sm font-medium">Interview questions &amp; scoring templates</summary><div className="mt-5"><InterviewPipelineBuilderView /></div></details></div>
      </TabsContent>
      <TabsContent value="events">
        <EventsMeetingsView />
      </TabsContent>
      <TabsContent value="branding">
        <ProfileBuilder />
      </TabsContent>
    </Tabs>
  )
}
