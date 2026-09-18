"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { scheduleDate, scheduleLocations } from "@/lib/data"

export function StudentBookingPreview() {
  const [activeLocationId, setActiveLocationId] = useState(scheduleLocations[0].id)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const activeLocation = useMemo(
    () => scheduleLocations.find((location) => location.id === activeLocationId)!,
    [activeLocationId],
  )

  const selectedSlot = activeLocation.slots.find((slot) => slot.id === selectedSlotId)

  function handleSelectLocation(locationId: string) {
    setActiveLocationId(locationId)
    setSelectedSlotId(null)
    setConfirmed(false)
  }

  function handleSelectSlot(slotId: string) {
    setSelectedSlotId(slotId)
    setConfirmed(false)
  }

  if (confirmed && selectedSlot) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-6 text-success" />
          </div>
          <h3 className="text-base font-semibold">Interview Confirmed</h3>
          <p className="text-sm text-muted-foreground">
            You&apos;re booked for {scheduleDate} at {selectedSlot.time} at {activeLocation.location}.
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
        <CardTitle className="text-lg">
          You&apos;ve been invited to Round 1 with Virginia Consulting Group!
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
              {location.location}
            </Button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{scheduleDate}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {activeLocation.slots.map((slot) => {
              const isFull = slot.students.length >= slot.capacity
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

        {selectedSlot && (
          <Button size="lg" className="w-full" onClick={() => setConfirmed(true)}>
            Confirm Interview Booking for Sept 7 at {selectedSlot.time}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
