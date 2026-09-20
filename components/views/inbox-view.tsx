"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Bell, Trash2, Mail, MailOpen, ArrowLeft, MapPin, CalendarDays } from "lucide-react"
import { ClubLogo } from "@/components/club-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useApplicationState } from "@/lib/application-state"
import type { ViewId } from "@/lib/views"
import { toast } from "sonner"

const filters = ["All", "Announcements", "Interviews", "Urgent"] as const
const selectStyle = "h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"

export function InboxView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { notifications: items, markNotificationRead, setNotificationsRead, deleteNotifications, restoreNotifications, focusEvent, focusNotificationId, focusNotification } = useApplicationState()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof filters)[number]>("All")
  const [readFilter, setReadFilter] = useState("all")
  const [club, setClub] = useState("all")
  const [sort, setSort] = useState("newest")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (focusNotificationId && items.some((item) => item.id === focusNotificationId)) {
      setSelectedId(focusNotificationId); markNotificationRead(focusNotificationId); focusNotification(null)
    }
  }, [focusNotificationId, items, markNotificationRead, focusNotification])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const clubs = useMemo(() => [...new Set(items.map((item) => item.club))].sort(), [items])
  const unread = items.filter((item) => !item.read).length
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const date = (item: (typeof items)[number]) => Date.parse(item.createdAt ?? "") || 0
    return items.filter((item) =>
      (filter !== "Announcements" || item.type === "Announcement") &&
      (filter !== "Interviews" || item.type === "Interview Invite") &&
      (filter !== "Urgent" || item.urgent) &&
      (readFilter === "all" || (readFilter === "read" ? item.read : !item.read)) &&
      (club === "all" || item.club === club) &&
      [item.title, item.preview, item.club, item.senderName, ...item.body].join(" ").toLowerCase().includes(q)
    ).sort((a, b) => {
      if (sort === "oldest") return date(a) - date(b)
      if (sort === "unread" && a.read !== b.read) return Number(a.read) - Number(b.read)
      if (sort === "urgent" && a.urgent !== b.urgent) return Number(b.urgent) - Number(a.urgent)
      if (sort === "club") return a.club.localeCompare(b.club) || date(b) - date(a)
      return date(b) - date(a)
    })
  }, [items, query, filter, readFilter, club, sort])
  // Bulk actions only affect checked notifications in the current results.
  const checkedIds = filtered.filter((item) => checked.has(item.id)).map((item) => item.id)
  const selected = items.find((item) => item.id === selectedId)
  const allChecked = filtered.length > 0 && checkedIds.length === filtered.length

  function remove(ids: string[]) {
    const removed = items.filter((item) => ids.includes(item.id))
    deleteNotifications(ids)
    setChecked((previous) => new Set([...previous].filter((id) => !ids.includes(id))))
    if (selectedId && ids.includes(selectedId)) setSelectedId(null)
    toast.success(`${removed.length} notification${removed.length === 1 ? "" : "s"} deleted`, {
      action: { label: "Undo", onClick: () => restoreNotifications(removed) },
    })
  }

  function resetFilters() {
    setQuery(""); setFilter("All"); setReadFilter("all"); setClub("all")
  }

  return (
    <div className="space-y-5 text-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500" role="status">{unread} unread · {items.length} notifications</p>
        <Button variant="outline" size="sm" disabled={!unread} onClick={() => setNotificationsRead(items.map((item) => item.id), true)}>
          <MailOpen className="size-4" /> Mark all as read
        </Button>
      </div>
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input aria-label="Search notifications" placeholder="Search notifications, clubs, or keywords" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
          </div>
          <select aria-label="Filter by read status" className={selectStyle} value={readFilter} onChange={(event) => setReadFilter(event.target.value)}>
            <option value="all">All read statuses</option><option value="unread">Unread</option><option value="read">Read</option>
          </select>
          <select aria-label="Filter by club" className={cn(selectStyle, "max-w-full sm:max-w-60")} value={club} onChange={(event) => setClub(event.target.value)}>
            <option value="all">All clubs</option>{clubs.map((name) => <option key={name}>{name}</option>)}
            {club !== "all" && !clubs.includes(club) && <option>{club}</option>}
          </select>
          <select aria-label="Sort notifications" className={selectStyle} value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="unread">Unread first</option><option value="urgent">Urgent first</option><option value="club">Club A–Z</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", filter === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:bg-neutral-50")}>{value}</button>)}
          {(query || filter !== "All" || club !== "all" || readFilter !== "all") && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>}
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-label="Notification list" className={cn("overflow-hidden rounded-xl border border-neutral-200 bg-white", selected && "hidden lg:block")}>
          <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">
            <Checkbox aria-label="Select all visible notifications" checked={allChecked ? true : checkedIds.length > 0 ? "indeterminate" : false} disabled={!filtered.length} onCheckedChange={() => setChecked(allChecked ? new Set() : new Set(filtered.map((item) => item.id)))} />
            <span className="text-xs text-neutral-500" role="status">{checkedIds.length ? `${checkedIds.length} selected` : `${filtered.length} results`}</span>
            {checkedIds.length > 0 && <div className="ml-auto flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setNotificationsRead(checkedIds, true); setChecked(new Set()) }}>Mark read</Button>
              <Button size="sm" variant="ghost" onClick={() => { setNotificationsRead(checkedIds, false); setChecked(new Set()) }}>Mark unread</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(checkedIds)} className="text-red-600"><Trash2 className="size-4" />Delete</Button>
            </div>}
          </div>
          <div className="max-h-[680px] overflow-y-auto divide-y divide-neutral-200">
            {filtered.map((item) => <div key={item.id} className={cn("flex items-start gap-3 px-4 py-4 transition-colors hover:bg-neutral-50", selectedId === item.id && "bg-neutral-50", !item.read && "border-l-2 border-l-primary")}>
              <Checkbox className="mt-1" aria-label={`Select ${item.title}`} checked={checked.has(item.id)} onCheckedChange={() => setChecked((previous) => { const next = new Set(previous); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next })} />
              <button type="button" aria-current={selectedId === item.id ? "true" : undefined} onClick={() => { setSelectedId(item.id); markNotificationRead(item.id) }} className="min-w-0 flex-1 space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
                <div className="flex items-center gap-2">
                  <ClubLogo clubId={item.clubId} logoUrl={item.logoUrl} text={item.logoText} color={item.color} className="size-7 shrink-0 rounded-md text-[10px]" />
                  <span className="text-xs text-neutral-500">{item.club}</span>
                  {!item.read && <span className="ml-auto shrink-0 text-[11px] font-medium text-primary">Unread</span>}
                </div>
                <p className={cn("text-sm leading-snug", !item.read ? "font-semibold" : "font-medium")}>{item.title}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">{item.preview}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                  {item.urgent && <span className="rounded bg-orange-50 px-1.5 py-0.5 font-medium text-orange-700">Urgent</span>}
                  <span>{item.type}</span><span aria-hidden="true">·</span><time dateTime={item.createdAt}>{item.fullDate === "Just now" && item.createdAt ? new Date(item.createdAt).toLocaleString() : item.fullDate}</time>
                </div>
              </button>
              <Button size="icon" variant="ghost" className="size-7 shrink-0 text-neutral-400 hover:text-red-600" aria-label={`Delete ${item.title}`} onClick={() => remove([item.id])}><Trash2 className="size-3.5" /></Button>
            </div>)}
            {!filtered.length && <div className="space-y-3 p-10 text-center">
              <Bell className="mx-auto size-7 text-neutral-300" /><p className="text-sm font-medium">{items.length ? "No matching notifications" : "You're all caught up"}</p>
              <p className="text-xs text-neutral-500">{items.length ? "Try another keyword or clear your filters." : "New club updates will appear here."}</p>
              {!!items.length && <Button size="sm" variant="outline" onClick={resetFilters}>Clear filters</Button>}
            </div>}
          </div>
        </section>
        <section aria-label="Notification details" className={cn("rounded-xl border border-neutral-200 bg-white", !selected && "hidden lg:block")}>
          {!selected ? <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center text-neutral-500"><Bell className="size-8 text-neutral-300" /><p className="text-sm">Choose a notification to read the full update.</p></div> : <>
            <div className="space-y-5 border-b border-neutral-200 p-5 sm:p-6">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSelectedId(null)}><ArrowLeft className="size-4" />Back to notifications</Button>
              <div className="flex items-center gap-3"><ClubLogo clubId={selected.clubId} logoUrl={selected.logoUrl} text={selected.logoText} color={selected.color} className="size-10 shrink-0 rounded-lg" /><div><p className="text-sm font-semibold">{selected.club}</p><p className="text-xs text-neutral-500">{selected.senderTitle}</p></div></div>
              <div><p className="mb-2 text-xs text-neutral-500">{selected.type} · {selected.fullDate}</p><h2 className="text-xl font-semibold leading-snug tracking-tight">{selected.title}</h2></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setNotificationsRead([selected.id], !selected.read)}>{selected.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}{selected.read ? "Mark unread" : "Mark read"}</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove([selected.id])}><Trash2 className="size-4" />Delete</Button>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              {selected.body.map((paragraph, index) => <p key={index} className="text-sm leading-7 text-neutral-700">{paragraph}</p>)}
              {selected.locationChange && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"><p className="flex items-center gap-2 text-sm font-medium"><MapPin className="size-4" />{selected.locationChange.newLocation}</p><p className="mt-1 text-xs text-neutral-500">Previously: {selected.locationChange.oldLocation}</p></div>}
              {(selected.eventId || selected.type === "Interview Invite" || selected.locationChange) && <Button variant="outline" onClick={() => { if (selected.eventId) focusEvent(selected.eventId); onNavigate("calendar") }}><CalendarDays className="size-4" />View calendar</Button>}
              {selected.cta && selected.type !== "Interview Invite" && <Button variant="outline" onClick={() => onNavigate("tracker")}>View applications</Button>}
            </div>
            <p className="border-t border-neutral-200 px-6 py-4 text-xs text-neutral-500">Club notifications are read-only. Replies aren't available here.</p>
          </>}
        </section>
      </div>
    </div>
  )
}
