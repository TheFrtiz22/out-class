"use client"

import { useState } from "react"
import { CalendarCheck2, DoorOpen, LayoutGrid, MapPin, Rows3 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApplicationState } from "@/lib/application-state"
import { type ScheduleBlock } from "@/lib/scheduler"
import { Input } from "@/components/ui/input"
import type { ViewId } from "@/lib/views"
import { CreateScheduleDialog } from "@/components/views/scheduler/create-schedule-dialog"
import { StudentBookingPreview } from "@/components/views/scheduler/student-booking-preview"
import { SlotCard } from "@/components/views/scheduler/slot-card"
import { InterviewerAvailabilityView } from "@/components/views/club-manager/interviewer-availability-view"
import { InterviewRoomPanelMatrixView } from "@/components/views/club-manager/interview-room-panel-matrix-view"

function BookingManagerPanel({ onNavigate, blocks, onCreate, selectedDate, setSelectedDate }: {
  onNavigate: (view: ViewId) => void; blocks: ScheduleBlock[]; onCreate: (block: ScheduleBlock) => void;
  selectedDate: string; setSelectedDate: (date: string) => void
}) {
  const [mode, setMode] = useState<"admin" | "student">("admin")
  const [locationFilter, setLocationFilter] = useState("all")

  const dateBlocks = blocks.filter((block) => block.date === selectedDate)
  const visibleLocations = dateBlocks.filter(
    (location) => locationFilter === "all" || location.id === locationFilter,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Interview scheduling</p><h2 className="text-2xl font-semibold tracking-tight">A room for every conversation.</h2><p className="mt-2 text-sm text-muted-foreground">Create rooms, open booking slots, and keep your interview day organized.</p></div>
        <div className="flex gap-6 text-sm"><div><span className="block text-2xl font-semibold">{dateBlocks.length}</span><span className="text-muted-foreground">Rooms</span></div><div><span className="block text-2xl font-semibold">{dateBlocks.reduce((sum, b) => sum + b.slots.length, 0)}</span><span className="text-muted-foreground">Time slots</span></div><div><span className="block text-2xl font-semibold">{dateBlocks.reduce((sum, b) => sum + b.slots.reduce((n, slot) => n + slot.bookedCount, 0), 0)}</span><span className="text-muted-foreground">Booked</span></div></div>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as "admin" | "student")}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="admin">Manage rooms</TabsTrigger>
          <TabsTrigger value="student">Student preview</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "admin" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <CreateScheduleDialog selectedDate={selectedDate} onCreate={(block) => { onCreate(block); setLocationFilter("all") }} />
              <div className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium">
                <Input aria-label="Schedule date" type="date" value={selectedDate} onChange={(event) => { if (event.target.value) { setSelectedDate(event.target.value); setLocationFilter("all") } }} />
              </div>
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <MapPin className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {dateBlocks.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.locationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-5">
            {visibleLocations.length === 0 && <div className="rounded-xl border border-dashed bg-slate-50/50 px-6 py-14 text-center"><DoorOpen className="mx-auto mb-4 size-9 text-primary" /><h3 className="text-lg font-semibold">Make room for your next members</h3><p className="mb-5 mt-2 text-sm text-muted-foreground">No rooms match this date and location. Create a room to start taking bookings.</p><CreateScheduleDialog selectedDate={selectedDate} onCreate={(block) => { onCreate(block); setLocationFilter("all") }} /></div>}
            {visibleLocations.map((location) => (
              <div key={location.id} className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold font-sans tracking-tight"><a href={location.mapUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{location.locationName}</a></h3><span className="ml-auto text-xs text-muted-foreground">{location.slots.length} slots · {location.slots.reduce((n, slot) => n + Math.max(0, slot.capacity - slot.bookedCount), 0)} openings</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {location.slots.map((slot) => (
                    <SlotCard key={slot.id} slot={slot} onLaunch={() => onNavigate("interview-workspace")} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <StudentBookingPreview key={selectedDate} blocks={dateBlocks} date={selectedDate} />
      )}
    </div>
  )
}

export function InterviewSchedulerView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { scheduleBlocks: blocks, setScheduleBlocks: setBlocks } = useApplicationState()
  const [selectedDate, setSelectedDate] = useState(blocks[0]?.date ?? new Date().toISOString().slice(0, 10))
  function handleCreate(block: ScheduleBlock) {
    setBlocks((previous) => [...previous, block])
    setSelectedDate(block.date)
  }
  const [section, setSection] = useState<"booking" | "availability" | "rooms">("booking")

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={section} onValueChange={(value) => setSection(value as typeof section)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="booking" className="gap-1.5">
            <Rows3 className="size-4" /> Booking Manager
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <CalendarCheck2 className="size-4" /> Interviewer Availability
          </TabsTrigger>
          <TabsTrigger value="rooms" className="gap-1.5">
            <LayoutGrid className="size-4" /> Room &amp; Panel Matrix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booking" className="mt-6">
          <BookingManagerPanel onNavigate={onNavigate} blocks={blocks} onCreate={handleCreate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
        </TabsContent>
        <TabsContent value="availability" className="mt-6">
          <InterviewerAvailabilityView />
        </TabsContent>
        <TabsContent value="rooms" className="mt-6">
          <InterviewRoomPanelMatrixView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
