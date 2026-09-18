"use client"

import { useMemo, useState } from "react"
import { Search, CalendarPlus, MapPin, CheckCircle2, Send, Inbox as InboxIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Notification } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import { toast } from "sonner"

type FilterId = "all" | "announcements" | "interviews" | "urgent"

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "announcements", label: "Announcements" },
  { id: "interviews", label: "Interview Invites" },
  { id: "urgent", label: "Urgent Updates" },
]

export function InboxView() {
  const { notifications: items, markNotificationRead } = useApplicationState()
  const [filter, setFilter] = useState<FilterId>("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const [reply, setReply] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((n) => {
      if (filter === "announcements" && n.type !== "Announcement") return false
      if (filter === "interviews" && n.type !== "Interview Invite") return false
      if (filter === "urgent" && !n.urgent) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.club.toLowerCase().includes(q)
      )
    })
  }, [items, filter, query])

  const unreadCount = items.filter((n) => !n.read).length

  const selected: Notification | null = useMemo(() => {
    if (selectedId) {
      const match = items.find((n) => n.id === selectedId)
      if (match) return match
    }
    return filtered[0] ?? null
  }, [items, selectedId, filtered])

  function selectThread(n: Notification) {
    setSelectedId(n.id)
    setReply("")
    if (!n.read) markNotificationRead(n.id)
  }

  function sendReply() {
    if (!reply.trim() || !selected) return
    toast.success(`Reply sent to ${selected.club}.`)
    setReply("")
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] flex-col gap-6 bg-white lg:flex-row">
      {/* Left Panel — Message Feed */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[35%]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Inbox</h2>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-white hover:bg-primary">{unreadCount} Unread</Badge>
            )}
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages"
              className="border-slate-200 bg-white pl-9 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "border-foreground bg-foreground text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto lg:max-h-[calc(100vh-20rem)]">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No messages in this view.
            </div>
          )}

          {filtered.map((n) => {
            const isSelected = selected?.id === n.id
            return (
              <button
                key={n.id}
                onClick={() => selectThread(n)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left shadow-none transition-colors",
                  isSelected ? "border-foreground bg-white ring-1 ring-[#051B3D]" : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: n.color }}
                >
                  {n.logoText}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-slate-500">{n.club}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{n.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!n.read && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                    <p
                      className={cn(
                        "truncate text-sm",
                        !n.read ? "font-semibold text-foreground" : "font-medium text-slate-600",
                      )}
                    >
                      {n.title}
                    </p>
                  </div>

                  <p className="truncate text-xs text-slate-500">{n.preview}</p>

                  {n.urgent && (
                    <Badge className="mt-1 border-none bg-secondary text-[11px] font-semibold text-muted-foreground hover:bg-secondary">
                      Urgent
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Panel — Active Message Reader */}
      <div className="flex w-full min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-none">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16 text-center text-slate-400">
            <InboxIcon className="size-8" />
            <p className="text-sm">Select a message to read it here.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 border-b border-slate-100 p-6">
              <div className="flex items-start gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: selected.color }}
                >
                  {selected.logoText}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{selected.club}</p>
                  <p className="text-xs text-slate-500">{selected.senderTitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      selected.type === "Interview Invite"
                        ? "border-foreground/30 text-foreground"
                        : "border-slate-300 text-slate-600",
                    )}
                  >
                    {selected.type}
                  </Badge>
                  <span className="text-xs text-slate-400">{selected.fullDate}</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold tracking-tight text-foreground">{selected.title}</h3>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {selected.body.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}

              {selected.locationChange && (
                <div className="rounded-xl border border-border bg-primary/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <MapPin className="size-4" />
                    </span>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Updated Location: {selected.locationChange.newLocation}
                        </p>
                        <p className="text-xs text-slate-500">
                          Changed from {selected.locationChange.oldLocation}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-primary text-white hover:bg-primary/90"
                          onClick={() => toast.success("Added to your calendar.")}
                        >
                          <CalendarPlus className="size-4" />
                          Add to My Calendar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-foreground/20 text-foreground"
                          onClick={() => toast.info(`Opening map for ${selected.locationChange?.newLocation}.`)}
                        >
                          <MapPin className="size-4" />
                          View in Map
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selected.cta && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Action requested: {selected.cta}</p>
                    <Button
                      size="sm"
                      className="bg-foreground text-white hover:bg-foreground/90"
                      onClick={() => toast.success(`${selected.cta} — done.`)}
                    >
                      {selected.cta}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={() => markNotificationRead(selected.id)}
                  disabled={selected.read}
                >
                  <CheckCircle2 className="size-4" />
                  {selected.read ? "Marked as Read" : "Mark as Read"}
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={`Reply to ${selected.club}...`}
                  className="min-h-10 resize-none border-slate-200 bg-white text-sm"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="shrink-0 bg-foreground text-white hover:bg-foreground/90"
                  onClick={sendReply}
                  disabled={!reply.trim()}
                  aria-label="Send reply"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
