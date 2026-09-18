"use client"

import { useCallback, useRef, useState } from "react"
import { CalendarClock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const START_HOUR = 8
const END_HOUR = 20
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function formatHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
}

function slotKey(day: string, hour: number) {
  return `${day}-${hour}`
}

export function InterviewerAvailabilityView() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [maxConsecutive, setMaxConsecutive] = useState("2")
  const [role, setRole] = useState("case-specialist")
  const [formats, setFormats] = useState<Set<string>>(new Set(["1-on-1"]))
  const [saved, setSaved] = useState(false)

  const isDragging = useRef(false)
  const dragMode = useRef<"add" | "remove">("add")

  const applyToSlot = useCallback((key: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === "add") next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const handlePointerDown = (key: string) => {
    isDragging.current = true
    const mode = selected.has(key) ? "remove" : "add"
    dragMode.current = mode
    applyToSlot(key, mode)
  }

  const handlePointerEnter = (key: string) => {
    if (!isDragging.current) return
    applyToSlot(key, dragMode.current)
  }

  const handlePointerUp = () => {
    isDragging.current = false
  }

  const toggleFormat = (value: string) => {
    setFormats((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      className="flex flex-col gap-6 bg-slate-50 pb-24"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div>
        <h2 className="text-xl font-bold text-foreground">Interviewer Availability Submission</h2>
        <p className="text-sm text-slate-500">Select your free blocks for Fall 2026 Recruitment.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Weekly grid */}
        <Card className="bg-white shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Weekly Availability</CardTitle>
            <p className="text-xs text-muted-foreground">Click and drag across time slots to mark yourself as available.</p>
          </CardHeader>
          <CardContent>
            <div className="select-none overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-[64px_repeat(7,1fr)]">
                {/* Header row */}
                <div />
                {DAYS.map((day) => (
                  <div key={day} className="pb-2 text-center text-xs font-semibold text-foreground">
                    {day}
                  </div>
                ))}

                {/* Time rows */}
                {HOURS.map((hour) => (
                  <div key={hour} className="contents">
                    <div className="flex items-start justify-end pr-2 pt-0.5 text-[11px] text-muted-foreground">
                      {formatHour(hour)}
                    </div>
                    {DAYS.map((day) => {
                      const key = slotKey(day, hour)
                      const isSelected = selected.has(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${day} ${formatHour(hour)}`}
                          onPointerDown={() => handlePointerDown(key)}
                          onPointerEnter={() => handlePointerEnter(key)}
                          className={cn(
                            "h-9 border border-slate-200 transition-colors",
                            isSelected ? "border-foreground bg-primary" : "bg-white hover:bg-orange-50",
                          )}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border border-foreground bg-primary" />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border border-slate-200 bg-white" />
                Unavailable
              </div>
              <span className="ml-auto font-medium text-foreground">{selected.size} hour{selected.size === 1 ? "" : "s"} selected</span>
            </div>
          </CardContent>
        </Card>

        {/* Preference settings */}
        <Card className="bg-white shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarClock className="size-4 text-muted-foreground" />
              Preference Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="max-consecutive">Max Consecutive Hours</Label>
              <Select value={maxConsecutive} onValueChange={setMaxConsecutive}>
                <SelectTrigger id="max-consecutive" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="3">3+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3">
              <Label>Preferred Interview Format</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="format-1on1"
                  checked={formats.has("1-on-1")}
                  onCheckedChange={() => toggleFormat("1-on-1")}
                />
                <Label htmlFor="format-1on1" className="text-sm font-normal">
                  1-on-1
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="format-panel"
                  checked={formats.has("panel")}
                  onCheckedChange={() => toggleFormat("panel")}
                />
                <Label htmlFor="format-panel" className="text-sm font-normal">
                  Panel (2-6 Interviewers)
                </Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role-designation">Role Designation</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role-designation" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead Interviewer</SelectItem>
                  <SelectItem value="case-specialist">Case Specialist</SelectItem>
                  <SelectItem value="general">General Evaluator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:pl-[calc(var(--sidebar-width,16rem)+1.5rem)]">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {saved && <span className="text-sm font-medium text-foreground">Availability saved.</span>}
          <Button onClick={handleSave} className="bg-primary text-white hover:bg-primary/90">
            Save My Availability
          </Button>
        </div>
      </div>
    </div>
  )
}
