"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, MapPinned, Megaphone, RotateCcw, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  BROADCAST_AUDIENCES,
  BROADCAST_TYPES,
  sentBroadcasts,
  type BroadcastAudience,
  type BroadcastType,
} from "@/lib/data"

const TYPE_BADGE_STYLES: Record<BroadcastType, string> = {
  "General Announcement": "border-slate-200 bg-slate-100 text-slate-700",
  "Location/Time Change": "border-amber-200 bg-amber-50 text-amber-700",
  "Urgent Deadline Alert": "border-border bg-secondary text-muted-foreground",
}

export function BroadcastMessagesView() {
  const [audiences, setAudiences] = useState<Set<BroadcastAudience>>(new Set(["Active Applicants"]))
  const [type, setType] = useState<BroadcastType>("General Announcement")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [locationAlertOn, setLocationAlertOn] = useState(false)
  const [oldLocation, setOldLocation] = useState("")
  const [newLocation, setNewLocation] = useState("")
  const [audiencePopoverOpen, setAudiencePopoverOpen] = useState(false)
  const [sentJustNow, setSentJustNow] = useState(false)
  const [history, setHistory] = useState(sentBroadcasts)

  const canSend = audiences.size > 0 && subject.trim().length > 0 && body.trim().length > 0

  const audienceLabel = useMemo(() => {
    if (audiences.size === 0) return "Select audience..."
    if (audiences.size === BROADCAST_AUDIENCES.length) return "All audiences"
    return Array.from(audiences).join(", ")
  }, [audiences])

  function toggleAudience(a: BroadcastAudience) {
    setAudiences((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  function handleSend() {
    if (!canSend) return
    const recipientEstimate =
      audiences.has("Subscribed Followers") && audiences.size === 1
        ? 612
        : audiences.size * 150 + Math.floor(Math.random() * 40)
    setHistory((prev) => [
      {
        id: `bc-${Date.now()}`,
        dateSent: "Just now",
        audiences: Array.from(audiences),
        subject: subject.trim(),
        type,
        deliveredPercent: 100,
        recipients: recipientEstimate,
      },
      ...prev,
    ])
    setSubject("")
    setBody("")
    setLocationAlertOn(false)
    setOldLocation("")
    setNewLocation("")
    setSentJustNow(true)
    setTimeout(() => setSentJustNow(false), 3000)
  }

  function handleDelete(id: string) {
    setHistory((prev) => prev.filter((b) => b.id !== id))
  }

  function handleResend(id: string) {
    setHistory((prev) =>
      prev.map((b) => (b.id === id ? { ...b, dateSent: "Just now (resent)", deliveredPercent: 100 } : b)),
    )
  }

  return (
    <div className="flex flex-col gap-6 bg-white pb-6 text-foreground">
      {/* Composer */}
      <Card className="bg-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground font-sans tracking-tight font-semibold">
            <Megaphone className="size-4 text-muted-foreground" />
            Send Broadcast
          </CardTitle>
          <CardDescription>
            Blast urgent notifications directly to subscribers, applicants, or members.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Audience Selector */}
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">Audience</Label>
              <Popover open={audiencePopoverOpen} onOpenChange={setAudiencePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={audiencePopoverOpen}
                    className="w-full justify-between border-slate-200 bg-white font-normal text-foreground hover:bg-slate-50"
                  >
                    <span className="truncate">{audienceLabel}</span>
                    <ChevronDown className="size-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-white p-2" align="start">
                  <div className="flex flex-col gap-1">
                    {BROADCAST_AUDIENCES.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAudience(a)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-slate-50"
                      >
                        <Checkbox checked={audiences.has(a)} className="pointer-events-none" />
                        <span className="flex-1">{a}</span>
                        <span className="text-xs text-slate-400">
                          {a === "Subscribed Followers" && "Public"}
                          {a === "Active Applicants" && "In Recruitment"}
                          {a === "Accepted Members" && "Internal"}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Notification Type */}
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">Notification Type</Label>
              <div className="flex flex-wrap gap-2">
                {BROADCAST_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      type === t
                        ? "border-foreground bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message fields */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-subject" className="text-foreground">
              Subject line
            </Label>
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Round 2 Interview Location Changed"
              className="border-slate-200 bg-white text-foreground focus-visible:ring-[#FF5900]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-body" className="text-foreground">
              Message body
            </Label>
            <Textarea
              id="broadcast-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the full message your recipients will see..."
              rows={5}
              className="border-slate-200 bg-white text-foreground focus-visible:ring-[#FF5900]"
            />
          </div>

          {/* Location override toggle */}
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MapPinned className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Attach Location/Time Change Alert
                </span>
              </div>
              <Switch checked={locationAlertOn} onCheckedChange={setLocationAlertOn} />
            </div>
            {locationAlertOn && (
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="old-location" className="text-xs text-slate-500">
                    Old Location / Time
                  </Label>
                  <Input
                    id="old-location"
                    value={oldLocation}
                    onChange={(e) => setOldLocation(e.target.value)}
                    placeholder="Shannon 318C · 3:00 PM"
                    className="border-slate-200 bg-white text-foreground focus-visible:ring-[#FF5900]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-location" className="text-xs text-slate-500">
                    New Location / Time
                  </Label>
                  <Input
                    id="new-location"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Rotunda Room 142 · 3:30 PM"
                    className="border-slate-200 bg-white text-foreground focus-visible:ring-[#FF5900]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex flex-col items-start gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Preview only. No notifications or emails will be delivered.
            </p>
            <div className="flex items-center gap-3">
              {sentJustNow && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Check className="size-3.5" /> Added to preview
                </span>
              )}
              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="gap-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="size-4" />
                Add to preview history
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="bg-white shadow-none">
        <CardHeader>
          <CardTitle className="text-foreground font-sans tracking-tight font-semibold">Sent Announcements History</CardTitle>
          <CardDescription>Past broadcasts sent to your subscribers, applicants, and members.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-500">Date Sent</TableHead>
                <TableHead className="text-slate-500">Target Audience</TableHead>
                <TableHead className="text-slate-500">Subject</TableHead>
                <TableHead className="text-slate-500">Type</TableHead>
                <TableHead className="text-slate-500">Delivery Rate</TableHead>
                <TableHead className="text-right text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((b) => (
                <TableRow key={b.id} className="border-slate-100">
                  <TableCell className="text-sm text-slate-600">{b.dateSent}</TableCell>
                  <TableCell className="text-sm text-foreground">
                    {b.audiences.join(", ")}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm font-medium text-foreground">
                    {b.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-normal", TYPE_BADGE_STYLES[b.type])}>
                      {b.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {b.deliveredPercent}% Delivered / {b.recipients} Recipients
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Resend ${b.subject}`}
                        onClick={() => handleResend(b.id)}
                        className="size-8 text-slate-500 hover:text-foreground"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${b.subject}`}
                        onClick={() => handleDelete(b.id)}
                        className="size-8 text-slate-500 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    No broadcasts sent yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
