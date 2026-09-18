"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CalendarPlus, Globe, MapPin, Pencil, Trash2, Users, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { managedEvents, type EventScope, type ManagedEvent } from "@/lib/data"

const NAVY = "#051B3D"
const ORANGE = "#FF5900"

/** The club this admin manages in Club Settings. */
const ADMIN_CLUB_ID = "vvf"

type FormState = {
  title: string
  scope: EventScope
  date: string
  time: string
  location: string
  zoomLink: string
}

const emptyForm: FormState = { title: "", scope: "Public", date: "", time: "", location: "", zoomLink: "" }

export function EventsMeetingsView() {
  const [events, setEvents] = useState<ManagedEvent[]>(managedEvents.filter((e) => e.clubId === ADMIN_CLUB_ID))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ManagedEvent | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function startEdit(event: ManagedEvent) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      scope: event.scope,
      date: event.date,
      time: event.time,
      location: event.location,
      zoomLink: event.zoomLink ?? "",
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date.trim() || !form.time.trim() || !form.location.trim()) {
      toast.error("Fill out title, date, time, and location before saving.")
      return
    }

    if (editingId) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingId
            ? {
                ...ev,
                title: form.title,
                scope: form.scope,
                date: form.date,
                time: form.time,
                location: form.location,
                zoomLink: form.zoomLink || undefined,
              }
            : ev,
        ),
      )
      toast.success("Event updated", { description: `${form.title} has been updated.` })
    } else {
      const newEvent: ManagedEvent = {
        id: `ev-${Date.now()}`,
        clubId: ADMIN_CLUB_ID,
        title: form.title,
        scope: form.scope,
        date: form.date,
        time: form.time,
        location: form.location,
        zoomLink: form.zoomLink || undefined,
      }
      setEvents((prev) => [newEvent, ...prev])
      toast.success("Event scheduled", { description: `${form.title} was added to your roster.` })
    }
    resetForm()
  }

  function confirmCancel() {
    if (!cancelTarget) return
    setEvents((prev) => prev.filter((ev) => ev.id !== cancelTarget.id))
    toast.success("Event cancelled", { description: `${cancelTarget.title} has been removed.` })
    setCancelTarget(null)
  }

  return (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-white shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold" style={{ color: NAVY }}>
            {editingId ? "Edit Event" : "Event Creator"}
          </CardTitle>
          <CardDescription>Schedule a public info session or an internal members-only meeting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="event-title" style={{ color: NAVY }}>
                Event Title
              </Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={'"Fall Info Session #1" or "Weekly Portfolio Review"'}
                className="border-gray-200 bg-white text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: NAVY }}>Event Scope</Label>
              <RadioGroup
                value={form.scope}
                onValueChange={(v) => set("scope", v as EventScope)}
                className="grid gap-3 sm:grid-cols-2"
              >
                <label
                  htmlFor="scope-public"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    form.scope === "Public" ? "border-foreground bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <RadioGroupItem value="Public" id="scope-public" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      <Globe className="size-3.5" /> Public / Info Session
                    </span>
                    <span className="block text-xs text-gray-500">
                      Visible to prospective applicants on your Club Page.
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="scope-members"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    form.scope === "Members Only"
                      ? "border-foreground bg-orange-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <RadioGroupItem value="Members Only" id="scope-members" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      <Users className="size-3.5" /> Members Only
                    </span>
                    <span className="block text-xs text-gray-500">
                      Shown only to accepted members in their Club Hub.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-date" style={{ color: NAVY }}>
                  Date & Time
                </Label>
                <Input
                  id="event-date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  placeholder={'"Thu, Sep 25" or "Every Tuesday"'}
                  className="border-gray-200 bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-time" style={{ color: NAVY }}>
                  Time
                </Label>
                <Input
                  id="event-time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                  placeholder="6:00 PM"
                  className="border-gray-200 bg-white text-gray-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-location" style={{ color: NAVY }}>
                Location / Room Number
              </Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="McIntire Room 220"
                className="border-gray-200 bg-white text-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-zoom" style={{ color: NAVY }}>
                Virtual Zoom Link (Optional)
              </Label>
              <Input
                id="event-zoom"
                value={form.zoomLink}
                onChange={(e) => set("zoomLink", e.target.value)}
                placeholder="https://uva.zoom.us/j/..."
                className="border-gray-200 bg-white text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" className="gap-1.5 text-white hover:opacity-90" style={{ backgroundColor: ORANGE }}>
                <CalendarPlus className="size-4" />
                {editingId ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: NAVY }}>
            Active Events Roster
          </h3>
          <p className="text-sm text-gray-500">Every upcoming session and meeting currently scheduled.</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          {events.map((event, i) => (
            <div
              key={event.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3.5",
                i !== events.length - 1 && "border-b border-gray-200",
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
                  <Badge
                    className={cn("border-transparent font-normal", event.scope !== "Public" && "bg-gray-100 text-gray-700")}
                    style={event.scope === "Public" ? { backgroundColor: NAVY, color: "white" } : undefined}
                  >
                    {event.scope}
                  </Badge>
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                  <span>{event.date}</span>
                  <span>·</span>
                  <span>{event.time}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {event.location}
                  </span>
                  {event.zoomLink && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Video className="size-3" /> Zoom link attached
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(event)}
                  className="gap-1.5 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelTarget(event)}
                  className="gap-1.5 border-gray-300 bg-white text-red-600 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" /> Cancel Event
                </Button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">No events scheduled yet. Create one above.</p>
          )}
        </div>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle style={{ color: NAVY }}>Cancel this event?</DialogTitle>
            <DialogDescription className="text-gray-500">
              {cancelTarget && `"${cancelTarget.title}" will be removed and attendees will no longer see it.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Keep Event
            </Button>
            <Button onClick={confirmCancel} className="bg-red-600 text-white hover:bg-red-700">
              Cancel Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
