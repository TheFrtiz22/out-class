"use client"

import { type FormEvent, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { createScheduleBlock, type ScheduleBlock } from "@/lib/scheduler"

export function CreateScheduleDialog({ selectedDate, onCreate }: { selectedDate: string; onCreate: (block: ScheduleBlock) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const block = createScheduleBlock({
        date: String(data.get("date")), locationName: String(data.get("locationName")),
        address: String(data.get("address")), startTime: String(data.get("startTime")),
        endTime: String(data.get("endTime")), duration: Number(data.get("duration")), capacity: Number(data.get("capacity")),
      })
      onCreate(block)
      setOpen(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create schedule.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); setError("") }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" />
          Create Schedule Block
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border bg-white shadow-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Schedule Block</DialogTitle>
          <DialogDescription>Generate a grid of time slots for a location and date.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="block-date">Date</Label>
            <Input id="block-date" name="date" type="date" required defaultValue={selectedDate} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-location">Display Name</Label>
            <Input id="block-location" name="locationName" required placeholder="e.g. Shannon 318C" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-address">Address or Maps Link (optional)</Label>
            <Input id="block-address" name="address" placeholder="Street address or https://maps…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-start">Start Time</Label>
              <Input id="block-start" name="startTime" type="time" required defaultValue="10:00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-end">End Time</Label>
              <Input id="block-end" name="endTime" type="time" required defaultValue="14:00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-duration">Slot Duration</Label>
              <Select name="duration" defaultValue="20">
                <SelectTrigger id="block-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 mins</SelectItem>
                  <SelectItem value="20">20 mins</SelectItem>
                  <SelectItem value="30">30 mins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-capacity">Capacity per Slot</Label>
              <Select name="capacity" defaultValue="2">
                <SelectTrigger id="block-capacity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 student</SelectItem>
                  <SelectItem value="2">2 students</SelectItem>
                  <SelectItem value="3">3 students</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Create Slots</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
