"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useApplicationState } from "@/lib/application-state"
import { currentStudent } from "@/lib/data"
import type { ScheduleBlock } from "@/lib/scheduler"

export function StudentBookingPreview({ blocks: scheduleLocations, date }: { blocks: ScheduleBlock[]; date: string }) {
  const { bookInterview } = useApplicationState()
  const [error, setError] = useState("")
  const scheduleDate = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const [activeLocationId, setActiveLocationId] = useState(scheduleLocations[0]?.id ?? "")
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const activeLocation = useMemo(
    () => scheduleLocations.find((location) => location.id === activeLocationId) ?? scheduleLocations[0],
    [activeLocationId, scheduleLocations],
  )

  const selectedSlot = activeLocation?.slots.find((slot) => slot.id === selectedSlotId)

  function handleSelectLocation(locationId: string) {
    setActiveLocationId(locationId)
    setSelectedSlotId(null)
    setConfirmed(false)
  }

  function handleSelectSlot(slotId: string) {
    setSelectedSlotId(slotId)
    setConfirmed(false)
  }

  if (!activeLocation) return <p className="border bg-white p-6 text-sm text-muted-foreground">No slots available for this date.</p>

  if (confirmed && selectedSlot) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-6 text-success" />
          </div>
          <h3 className="text-base font-semibold font-sans tracking-tight">Interview Confirmed</h3>
          <p className="text-sm text-muted-foreground">
            You&apos;re booked for {scheduleDate} at {selectedSlot.time} at {activeLocation.locationName}.
          </p>
          <Button variant="outline" size="sm" onClick={() => setConfirmed(false)} className="mt-2">
            Change time
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-lg font-sans tracking-tight font-semibold">
          You&apos;ve been invited to Round 1 with Virginia Venture Fund!
        </CardTitle>
        <CardDescription>Pick your interview time.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap justify-center gap-2">
          {scheduleLocations.map((location) => (
            <Button
              key={location.id}
              size="sm"
              variant={location.id === activeLocationId ? "default" : "outline"}
              onClick={() => handleSelectLocation(location.id)}
              className="gap-1.5"
            >
              <MapPin className="size-3.5" />
              {location.locationName}
            </Button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{scheduleDate}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {activeLocation.slots.map((slot) => {
              const isFull = slot.bookedCount >= slot.capacity && !slot.candidates.some((candidate) => candidate.email === currentStudent.email)
              const isSelected = slot.id === selectedSlotId
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isFull}
                  onClick={() => handleSelectSlot(slot.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium tabular-nums transition-colors",
                    isFull && "cursor-not-allowed border-dashed text-muted-foreground/50 line-through",
                    !isFull && !isSelected && "hover:border-neutral-400 hover:bg-muted",
                    isSelected && "border-foreground bg-status-booked text-status-booked-foreground",
                  )}
                >
                  {slot.time}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {selectedSlot && (
          <Button size="lg" className="w-full" onClick={() => { const failure = bookInterview(activeLocation.id, selectedSlot.id); setError(failure ?? ""); if (!failure) setConfirmed(true) }}>
            Confirm Interview Booking for {scheduleDate} at {selectedSlot.time}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
