"use client"

import { useState } from "react"
import {
  Plus,
  Wand2,
  RefreshCw,
  Lock,
  Eye,
  X,
  Clock,
  MapPin,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type PanelFormat = "1-on-1" | "2-on-1" | "3-on-1" | "4-on-1" | "Full Panel (6)"

type Interviewer = {
  id: string
  name: string
  role?: "Lead"
  initials: string
}

type Candidate = {
  id: string
  name: string
}

type Room = {
  id: string
  name: string
  location: string
  panelFormat: PanelFormat
  candidate: Candidate | null
  interviewers: (Interviewer | null)[]
}

const PANEL_FORMATS: PanelFormat[] = ["1-on-1", "2-on-1", "3-on-1", "4-on-1", "Full Panel (6)"]

const TIME_SLOTS = [
  "Friday, Sept 25 — 2:00 PM – 2:30 PM",
  "Friday, Sept 25 — 2:30 PM – 3:00 PM",
  "Friday, Sept 25 — 3:00 PM – 3:30 PM",
  "Saturday, Sept 26 — 10:00 AM – 10:30 AM",
]

const interviewerPool: Interviewer[] = [
  { id: "int-1", name: "Alex M.", role: "Lead", initials: "AM" },
  { id: "int-2", name: "Sarah T.", initials: "ST" },
  { id: "int-3", name: "Chris P.", initials: "CP" },
  { id: "int-4", name: "Jordan B.", initials: "JB" },
  { id: "int-5", name: "Priya N.", initials: "PN" },
  { id: "int-6", name: "Marcus L.", initials: "ML" },
  { id: "int-7", name: "Elena V.", initials: "EV" },
  { id: "int-8", name: "Devon K.", initials: "DK" },
]

const candidateQueue: Candidate[] = [
  { id: "cand-1", name: "Jordan Avery" },
  { id: "cand-2", name: "Maya Chen" },
  { id: "cand-3", name: "Liam Foster" },
  { id: "cand-4", name: "Priya Das" },
  { id: "cand-5", name: "Noah Kim" },
]

function emptySlots(): (Interviewer | null)[] {
  return Array.from({ length: 6 }, () => null)
}

const initialRooms: Room[] = [
  {
    id: "room-1",
    name: "Room 101 (Rouss Hall)",
    location: "Rouss Hall 101",
    panelFormat: "3-on-1",
    candidate: { id: "cand-1", name: "Jordan Avery" },
    interviewers: [
      { id: "int-1", name: "Alex M.", role: "Lead", initials: "AM" },
      { id: "int-2", name: "Sarah T.", initials: "ST" },
      { id: "int-3", name: "Chris P.", initials: "CP" },
      null,
      null,
      null,
    ],
  },
  {
    id: "room-2",
    name: "Room 102 (Rouss Hall)",
    location: "Rouss Hall 102",
    panelFormat: "2-on-1",
    candidate: null,
    interviewers: emptySlots(),
  },
  {
    id: "room-3",
    name: "Virtual Room A",
    location: "Zoom — Virtual Room A",
    panelFormat: "1-on-1",
    candidate: { id: "cand-2", name: "Maya Chen" },
    interviewers: [{ id: "int-4", name: "Jordan B.", initials: "JB" }, null, null, null, null, null],
  },
]

function capacityFor(format: PanelFormat) {
  switch (format) {
    case "1-on-1":
      return 1
    case "2-on-1":
      return 2
    case "3-on-1":
      return 3
    case "4-on-1":
      return 4
    case "Full Panel (6)":
      return 6
  }
}

export function InterviewRoomPanelMatrixView() {
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0])
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [previewOpen, setPreviewOpen] = useState(false)

  function addRoom() {
    const n = rooms.length + 1
    const room: Room = {
      id: `room-${Date.now()}`,
      name: `Room ${100 + n} (Rouss Hall)`,
      location: `Rouss Hall ${100 + n}`,
      panelFormat: "2-on-1",
      candidate: null,
      interviewers: emptySlots(),
    }
    setRooms((prev) => [...prev, room])
  }

  function removeRoom(id: string) {
    setRooms((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRoom(id: string, patch: Partial<Room>) {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function assignInterviewer(roomId: string, slotIndex: number, interviewer: Interviewer) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              interviewers: r.interviewers.map((slot, i) => (i === slotIndex ? interviewer : slot)),
            }
          : r,
      ),
    )
  }

  function removeInterviewer(roomId: string, slotIndex: number) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, interviewers: r.interviewers.map((slot, i) => (i === slotIndex ? null : slot)) }
          : r,
      ),
    )
  }

  function assignCandidate(roomId: string, candidate: Candidate) {
    updateRoom(roomId, { candidate })
  }

  function autoFillRooms() {
    setRooms((prev) => {
      const usedInterviewerIds = new Set(
        prev.flatMap((r) => r.interviewers.flatMap((i) => i ? [i.id] : []))
      )
      const usedCandidateIds = new Set(
        prev.flatMap((r) => r.candidate ? [r.candidate.id] : [])
      )
      const availableInterviewers = interviewerPool.filter((i) => !usedInterviewerIds.has(i.id))
      const availableCandidates = candidateQueue.filter((c) => !usedCandidateIds.has(c.id))

      let interviewerCursor = 0
      let candidateCursor = 0

      const next = prev.map((room) => {
        let candidate = room.candidate
        if (!candidate && availableCandidates[candidateCursor]) {
          candidate = availableCandidates[candidateCursor]
          candidateCursor += 1
        }

        const capacity = capacityFor(room.panelFormat)
        const interviewers = [...room.interviewers]
        for (let i = 0; i < interviewers.length && i < capacity; i++) {
          if (!interviewers[i] && availableInterviewers[interviewerCursor]) {
            interviewers[i] = availableInterviewers[interviewerCursor]
            interviewerCursor += 1
          }
        }

        return { ...room, candidate, interviewers }
      })

      return next
    })

    toast.success("Panel rooms auto-filled", {
      description: "Available interviewers and queued candidates were matched to open rooms.",
    })
  }

  const previewRoom = rooms.find((r) => r.candidate) ?? rooms[0]

  return (
    <div className="bg-white">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-foreground font-sans tracking-tight">Interview Room &amp; Panel Matrix</h2>
        <p className="mt-1 text-sm text-slate-500">
          Build interview rooms, staff each panel, and schedule candidates for this time slot.
        </p>
      </div>

      {/* Top Controls */}
      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-slate-400" />
          <Select value={timeSlot} onValueChange={setTimeSlot}>
            <SelectTrigger className="w-full min-w-64 border-gray-200 bg-white text-sm text-foreground sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={addRoom}
            className="gap-1.5 border-gray-300 bg-white text-sm font-medium text-foreground hover:bg-slate-100"
          >
            <Plus className="size-4" /> Add Room
          </Button>
          <Button
            type="button"
            onClick={autoFillRooms}
            className="gap-1.5 bg-primary text-sm font-medium text-white hover:bg-primary/90"
          >
            <Wand2 className="size-4" /> Auto-Fill Panel Rooms
          </Button>
        </div>
      </div>

      {/* Room Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const capacity = capacityFor(room.panelFormat)
          const filledCount = room.interviewers.filter(Boolean).length

          return (
            <div key={room.id} className="flex flex-col rounded-md border border-gray-200 bg-white p-4">
              {/* Room Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{room.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="size-3" /> {room.location}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-slate-400 hover:text-muted-foreground"
                  onClick={() => removeRoom(room.id)}
                  aria-label={`Remove ${room.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {/* Candidate Assignment Slot */}
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white p-3 shadow-none">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Candidate</p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {room.candidate ? room.candidate.name : "Unassigned"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-slate-400 hover:text-muted-foreground"
                      aria-label="Swap or reassign candidate"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Assign candidate</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {candidateQueue.map((c) => (
                      <DropdownMenuItem key={c.id} onSelect={() => assignCandidate(room.id, c)}>
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Panel Format Indicator */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Panel Format</span>
                <Select
                  value={room.panelFormat}
                  onValueChange={(v) => updateRoom(room.id, { panelFormat: v as PanelFormat })}
                >
                  <SelectTrigger className="h-8 w-auto border-gray-200 bg-white text-xs text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PANEL_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interviewer Panel Slots */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Interviewers ({filledCount}/{capacity} filled)
                </p>
                {room.interviewers.map((slot, index) => {
                  const isWithinCapacity = index < capacity

                  if (slot) {
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-2",
                          isWithinCapacity ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-white",
                        )}
                      >
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-foreground text-[10px] font-semibold text-white">
                            {slot.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {index + 1}. {slot.name}
                        </span>
                        {slot.role && (
                          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                            {slot.role}
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-slate-400 hover:text-muted-foreground"
                          onClick={() => removeInterviewer(room.id, index)}
                          aria-label="Remove interviewer"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )
                  }

                  if (!isWithinCapacity) {
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-center rounded-md border border-dashed border-gray-100 px-2.5 py-2 text-xs text-slate-300"
                      >
                        Slot {index + 1}/6 — exceeds panel format
                      </div>
                    )
                  }

                  return (
                    <DropdownMenu key={index}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-foreground hover:text-muted-foreground"
                        >
                          <Plus className="size-3.5" /> Add Interviewer (Slot {index + 1}/6)
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        <DropdownMenuLabel>Assign interviewer</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {interviewerPool.map((i) => (
                          <DropdownMenuItem key={i.id} onSelect={() => assignInterviewer(room.id, index, i)}>
                            {i.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Privacy & Applicant Preview Banner */}
      <div className="mt-5 flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-foreground">Applicant Privacy Shield Active:</span> Applicants
            assigned to these rooms will only see the time and room location (e.g., &ldquo;2:00 PM — Rouss Hall
            101&rdquo;). Interviewer names, panel sizes, and evaluator identities are strictly hidden from student
            profiles.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          className="shrink-0 gap-1.5 border-gray-300 bg-white text-sm font-medium text-foreground hover:bg-slate-100"
        >
          <Eye className="size-4" /> Preview Applicant View
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground font-sans tracking-tight font-semibold">Applicant View</DialogTitle>
            <DialogDescription>This is the minimal, scrubbed version the student sees.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your Interview</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{timeSlot.split("—")[1]?.trim() ?? timeSlot}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="size-3.5" /> {previewRoom?.location ?? "Location TBD"}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            No interviewer names, panel size, or evaluator identities are shown to applicants.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
