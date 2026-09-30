"use client"

import { type FormEvent, useMemo, useState } from "react"
import { CalendarDays, Clock, DoorOpen, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createScheduleBlock, generateTimeSlots, type ScheduleBlock } from "@/lib/scheduler"

export function CreateScheduleDialog({ selectedDate, onCreate }: { selectedDate: string; onCreate: (block: ScheduleBlock) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [date, setDate] = useState(selectedDate)
  const [start, setStart] = useState("10:00")
  const [end, setEnd] = useState("12:00")
  const [duration, setDuration] = useState("20")
  const [capacity, setCapacity] = useState("1")
  const preview = useMemo(() => {
    try { return { slots: generateTimeSlots(start, end, Number(duration), Number(capacity)), error: "" } }
    catch (error) { return { slots: [], error: error instanceof Error ? error.message : "Check your schedule." } }
  }, [start, end, duration, capacity])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const block = createScheduleBlock({ date, locationName: name, address: String(data.get("address") ?? ""), startTime: start, endTime: end, duration: Number(duration), capacity: Number(capacity) })
      onCreate(block)
      setOpen(false)
      toast.success(`${block.locationName} created`, { description: `${block.slots.length} interview slots are ready for booking.` })
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create room.") }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); setError(""); if (value) { setDate(selectedDate); setName("") } }}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" />Create interview room</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Create an interview room</DialogTitle>
          <DialogDescription>Choose a location and time window. We’ll create the booking slots for you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-5">
              <div className="space-y-2"><Label htmlFor="block-location">Room or location name</Label><Input autoFocus id="block-location" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shannon 318C" /></div>
              <div className="space-y-2"><Label htmlFor="block-address">Address or meeting link <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="block-address" name="address" placeholder="Street address, Maps link, or video call URL" /></div>
              <div className="space-y-2"><Label htmlFor="block-date">Interview date</Label><Input id="block-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="block-start">Start time</Label><Input id="block-start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="block-end">End time</Label><Input id="block-end" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="block-duration">Interview length</Label><Select value={duration} onValueChange={setDuration}><SelectTrigger id="block-duration"><SelectValue /></SelectTrigger><SelectContent>{[15, 20, 30, 45, 60].map((n) => <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="block-capacity">Students per slot</Label><Select value={capacity} onValueChange={setCapacity}><SelectTrigger id="block-capacity"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "student" : "students"}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            <aside className="rounded-xl border bg-slate-50 p-5" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Room preview</p>
              <DoorOpen className="my-4 size-7 text-primary" />
              <h3 className="break-words text-lg font-semibold">{name.trim() || "Your interview room"}</h3>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" />{date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Choose a date"}</p>
              <div className="my-5 grid grid-cols-2 gap-3 border-y py-4">
                <div><Clock className="mb-2 size-4 text-muted-foreground" /><p className="text-2xl font-semibold">{preview.slots.length}</p><p className="text-xs text-muted-foreground">interview slots</p></div>
                <div><Users className="mb-2 size-4 text-muted-foreground" /><p className="text-2xl font-semibold">{preview.slots.length * Number(capacity)}</p><p className="text-xs text-muted-foreground">student openings</p></div>
              </div>
              {preview.error ? <p className="text-sm text-destructive">{preview.error}</p> : <><div className="flex flex-wrap gap-2">{preview.slots.slice(0, 6).map((slot) => <span key={slot.id} className="rounded-md border bg-white px-2 py-1 text-xs tabular-nums">{slot.time}</span>)}</div>{preview.slots.length > 6 && <p className="mt-2 text-xs text-muted-foreground">+ {preview.slots.length - 6} more slots</p>}<p className="mt-4 text-xs leading-relaxed text-muted-foreground">Each slot lasts {duration} minutes and accepts {capacity} {capacity === "1" ? "student" : "students"}.</p></>}
            </aside>
          </div>
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          <DialogFooter className="border-t pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={!name.trim() || !date || !!preview.error}>Create room · {preview.slots.length} slots</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
