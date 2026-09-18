"use client"

import { useState } from "react"
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

export function CreateScheduleDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" />
          Create Schedule Block
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Schedule Block</DialogTitle>
          <DialogDescription>Generate a grid of time slots for a location and date.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="block-date">Date</Label>
            <Input id="block-date" type="text" defaultValue="Monday, September 7th" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="block-location">Location Name</Label>
            <Input id="block-location" placeholder="e.g. Shannon 318C" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-start">Start Time</Label>
              <Input id="block-start" type="text" defaultValue="10:00 AM" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="block-end">End Time</Label>
              <Input id="block-end" type="text" defaultValue="2:00 PM" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="block-duration">Slot Duration</Label>
              <Select defaultValue="20">
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
              <Select defaultValue="2">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Create Slots</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
