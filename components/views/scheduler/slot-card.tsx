"use client"

import { Video } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SchedulerSlot } from "@/lib/scheduler"

export function SlotCard({
  slot,
  onLaunch,
}: {
  slot: SchedulerSlot
  onLaunch: () => void
}) {
  const bookedCount = slot.bookedCount
  const isFull = bookedCount >= slot.capacity
  const isEmpty = bookedCount === 0

  return (
    <div data-slot-status={isEmpty ? "available" : isFull ? "full" : "partial"}
      className={cn(
        "oc-interview-slot group relative flex min-h-[140px] flex-col justify-between rounded-lg border border-border p-4",
        isEmpty ? "border-dashed bg-slate-50/60" : "bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">{slot.time}</span>
        <Badge
          variant={isFull ? "default" : "outline"}
          className={cn("font-normal", isFull && "bg-status-booked text-status-booked-foreground")}
        >
          {isEmpty ? "Available" : `${bookedCount}/${slot.capacity} booked`}
        </Badge>
      </div>

      {isEmpty ? (
        <p className="text-xs text-muted-foreground">No candidates booked yet</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {slot.candidates.map((student) => (
            <div key={student.email} className="flex items-center gap-2">
              <Avatar className="size-6">
                <AvatarImage src={student.headshotUrl} alt="" />
                <AvatarFallback className="text-[length:var(--oc-size-10)] font-medium">{student.initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 leading-tight">
                <span className="truncate text-xs font-medium">{student.name}</span>
                <span className="truncate text-[length:var(--oc-size-11)] text-muted-foreground">{student.email}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isEmpty && (
        <Button
          size="sm"
          onClick={onLaunch}
          className="mt-3 min-w-0 gap-1 bg-primary px-2 text-xs text-primary-foreground shadow-none hover:bg-primary/90" aria-label="Launch Live Interview Workspace" title="Launch Live Interview Workspace"
        >
          <Video className="size-3.5" />
          Open workspace
        </Button>
      )}
    </div>
  )
}
