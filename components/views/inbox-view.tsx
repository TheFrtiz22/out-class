"use client"
import { schedulingDateTime } from "@/lib/scheduling-config"

import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { CommunicationsInbox } from "@/components/communications-inbox"
import { useEffect, useMemo, useState, useRef } from "react"
import { Bell, Trash2, Mail, MailOpen, ArrowLeft, MapPin, CalendarDays } from "@/components/icons"
import { ClubLogo } from "@/components/club-logo"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SearchField } from "@/components/ui/search-field"
import { PillSelect } from "@/components/ui/pill-select"
import { FilterPopover } from "@/components/ui/filter-popover"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useApplicationState } from "@/lib/application-state"
import type { ViewId } from "@/lib/views"
import { notificationGroups, notificationPriority } from "@/lib/student-agenda"
import { toast } from "sonner"
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests"
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context"
import { Panel } from "@/components/ui/panel"
import { pluralize } from "@/lib/copy/terms"
import { notificationSettingsHref } from "@/lib/settings-navigation"

const filters = ["All", "Announcements", "Interviews", "Urgent"] as const

export function InboxView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const demo = useDemoMode()
  const { invitations } = useOrganizationInvitations()
  const {
    notifications: items,
    markNotificationRead,
    markAllNotificationsRead,
    setNotificationsRead,
    deleteNotifications,
    restoreNotifications,
    focusEvent,
    focusApplication,
    focusNotificationId,
    focusNotification,
    trackedApps = [],
  } = useApplicationState()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof filters)[number]>("All")
  const [readFilter, setReadFilter] = useState("all")
  const [club, setClub] = useState("all")
  const [sort, setSort] = useState("priority")
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (focusNotificationId && items.some((item) => item.id === focusNotificationId)) {
      setSelectedId(focusNotificationId)
      markNotificationRead(focusNotificationId)
      focusNotification(null)
    }
  }, [focusNotificationId, items, markNotificationRead, focusNotification])
  useEffect(() => {
    if (selectedId) detailHeading.current?.focus()
  }, [selectedId])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const clubs = useMemo(() => [...new Set(items.map((item) => item.club))].sort(), [items])
  const unread = items.filter((item) => !item.read).length
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const date = (item: (typeof items)[number]) => Date.parse(item.createdAt ?? "") || 0
    return items
      .filter(
        (item) =>
          (filter !== "Announcements" || item.type === "Announcement") &&
          (filter !== "Interviews" || item.type === "Interview Invite") &&
          (filter !== "Urgent" || item.urgent) &&
          (readFilter === "all" || (readFilter === "read" ? item.read : !item.read)) &&
          (club === "all" || item.club === club) &&
          [item.title, item.preview, item.club, item.senderName, ...item.body]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => {
        if (sort === "priority")
          return notificationPriority(a) - notificationPriority(b) || date(b) - date(a)
        if (sort === "oldest") return date(a) - date(b)
        if (sort === "unread" && a.read !== b.read) return Number(a.read) - Number(b.read)
        if (sort === "urgent" && a.urgent !== b.urgent) return Number(b.urgent) - Number(a.urgent)
        if (sort === "club") return a.club.localeCompare(b.club) || date(b) - date(a)
        return date(b) - date(a)
      })
  }, [items, query, filter, readFilter, club, sort])
  // Bulk actions only affect checked notifications in the current results.
  const checkedIds = filtered.filter((item) => checked.has(item.id)).map((item) => item.id)
  const groups = notificationGroups(filtered, sort === "club", sort === "priority")
  const countGroup = groups.find(group => group.label === "Club updates")?.label ?? groups[0]?.label
  const notificationCount = <p className="text-xs font-normal normal-case tracking-normal text-muted-foreground" role="status">{unread} unread · {items.length} {items.length === 1 ? "notification" : "notifications"}</p>
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
    setQuery("")
    setFilter("All")
    setReadFilter("all")
    setClub("all")
  }

  // Notification settings open from the Inbox header; filters show only once the list is long enough to need them.
  const filtering = !!query || filter !== "All" || club !== "all" || readFilter !== "all" || sort !== "priority"
  const showFilters = items.length >= 5 || filtering
  return (
    <div className="oc-inbox-workspace max-w-[var(--oc-content-width)] space-y-6 text-foreground">
      {invitations.length > 0 && <OrganizationOwnershipRequests enabled includeDismissed />}
      {showFilters && <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchField aria-label="Search notifications" placeholder="Search notifications, clubs, or keywords" value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} containerClassName="min-w-0 flex-1 basis-60" />
          <SegmentedControl label="Read status" size="compact" value={readFilter} onChange={setReadFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: unread || undefined }, { value: "read", label: "Read" }]} />
          <FilterPopover label="Filter" title="Notification filters" align="end" count={[filter !== "All", club !== "all", sort !== "priority"].filter(Boolean).length}>
            <div className="oc-filter-field"><span className="oc-filter-field-label">Type</span>
              <SegmentedControl label="Notification type" size="compact" value={filter} onChange={setFilter} options={filters.map((value) => ({ value, label: value }))} />
            </div>
            <div className="oc-filter-field"><span className="oc-filter-field-label">Club</span>
              <PillSelect label="Filter by club" size="compact" value={club} active={club !== "all"} onChange={setClub}
                options={[{ value: "all", label: "All clubs" }, ...clubs.map((name) => ({ value: name, label: name })), ...(club !== "all" && !clubs.includes(club) ? [{ value: club, label: club }] : [])]} />
            </div>
            <div className="oc-filter-field"><span className="oc-filter-field-label">Sort</span>
              <PillSelect label="Sort notifications" size="compact" value={sort} active={sort !== "priority"} onChange={setSort}
                options={[{ value: "priority", label: "Recruiting priority" }, { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "unread", label: "Unread first" }, { value: "urgent", label: "Urgent first" }, { value: "club", label: "Club A–Z" }]} />
            </div>
          </FilterPopover>
          {filtering && (<Button variant="ghost" size="sm" onClick={() => { resetFilters(); setSort("priority") }}>Clear filters</Button>)}
        </div>
      </Panel>}
      <div
        className={cn(
          "grid items-start gap-8",
          selected && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
        )}
      >
        <section
          aria-label="Notification list"
          className={cn("min-w-0 overflow-hidden", selected && "hidden lg:block")}
        >
          <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <Checkbox
              aria-label="Select all visible notifications"
              checked={allChecked ? true : checkedIds.length > 0 ? "indeterminate" : false}
              disabled={!filtered.length}
              onCheckedChange={() =>
                setChecked(allChecked ? new Set() : new Set(filtered.map((item) => item.id)))
              }
            />
            <span className="text-xs text-muted-foreground" role="status">
              {checkedIds.length ? `${checkedIds.length} selected` : pluralize(filtered.length, "result")}
            </span>
            {checkedIds.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNotificationsRead(checkedIds, true)
                    setChecked(new Set())
                  }}
                >
                  Mark read
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNotificationsRead(checkedIds, false)
                    setChecked(new Set())
                  }}
                >
                  Mark unread
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(checkedIds)}
                  className="text-red-600"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" className="ml-auto" disabled={!unread} onClick={() => void markAllNotificationsRead()}>
              <MailOpen className="size-4" />Mark all as read
            </Button>
          </div>
          {!groups.length && <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <h3 className="oc-card-heading uppercase tracking-wider text-muted-foreground">Club updates</h3>
            {notificationCount}
          </div>}
          <div className="oc-inbox-workspace space-y-6">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                  <h3 className="oc-card-heading uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                  {group.label === countGroup && notificationCount}
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 border-l-2 border-transparent px-3 py-5 motion-safe:animate-in motion-safe:fade-in motion-safe:transition-colors motion-safe:duration-200 hover:bg-secondary/40",
                        selectedId === item.id && "bg-secondary/50",
                        !item.read && "border-l-primary bg-secondary/20",
                      )}
                    >
                      <Checkbox
                        className="mt-1"
                        aria-label={`Select ${item.title}`}
                        checked={checked.has(item.id)}
                        onCheckedChange={() =>
                          setChecked((previous) => {
                            const next = new Set(previous)
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                            return next
                          })
                        }
                      />
                      <button
                        data-notification-id={item.id}
                        type="button"
                        aria-current={selectedId === item.id ? "true" : undefined}
                        onClick={() => {
                          setSelectedId(item.id)
                          markNotificationRead(item.id)
                        }}
                        className="min-w-0 flex-1 space-y-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <div className="flex items-center gap-2">
                          <ClubLogo
                            clubId={item.clubId}
                            logoUrl={item.logoUrl} marketing={item.marketing}
                            text={item.logoText}
                            color={item.color}
                            className="size-7 shrink-0 rounded-md text-[length:var(--oc-size-10)]"
                          />
                          <span className="text-xs text-muted-foreground">{item.club}</span>
                          {!item.read && (
                            <span className="ml-auto shrink-0 text-[length:var(--oc-size-11)] font-medium text-primary">
                              <span
                                aria-hidden="true"
                                className="mr-1 inline-block size-1.5 rounded-full bg-primary"
                              />
                              Unread
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !item.read ? "font-semibold" : "font-medium",
                          )}
                        >
                          {item.title}
                        </p>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {item.preview}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[length:var(--oc-size-11)] text-muted-foreground">
                          {item.urgent && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                              Urgent
                            </span>
                          )}
                          <span>{item.type}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={item.createdAt}>
                            {item.fullDate === "Just now" && item.createdAt
                              ? schedulingDateTime(item.createdAt)
                              : item.fullDate}
                          </time>
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => remove([item.id])}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!filtered.length && (
              <div className="space-y-3 p-10 text-center">
                <Bell className="mx-auto size-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {items.length ? "No matching notifications" : "No notifications yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {items.length
                    ? "Your keyword or filters hide every notification."
                    : "Nothing has been sent to you yet. Choose which updates you want by email."}
                </p>
                {items.length
                  ? <Button size="sm" variant="outline" onClick={resetFilters}>Clear filters</Button>
                  : !demo.isDemoEnabled && <Button size="sm" variant="outline" asChild><Link href={notificationSettingsHref} scroll={false}>Notification settings</Link></Button>}
              </div>
            )}
          </div>
        </section>
        <section
          aria-label="Notification details"
          className={cn("oc-detail-panel min-w-0", !selected && "hidden")}
        >
          {!selected ? (
            <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <Bell className="size-6 text-muted-foreground" />
              <p className="text-sm">Choose a notification to read the full update.</p>
            </div>
          ) : (
            <>
              <div className="space-y-5 border-b border-border p-5 sm:p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const previous = selectedId
                    setSelectedId(null)
                    requestAnimationFrame(() => {
                      if (previous)
                        document
                          .querySelector<HTMLButtonElement>(
                            `[data-notification-id="${CSS.escape(previous)}"]`,
                          )
                          ?.focus()
                    })
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Back to notifications
                </Button>
                <div className="flex items-center gap-3">
                  <ClubLogo
                    clubId={selected.clubId}
                    logoUrl={selected.logoUrl} marketing={selected.marketing}
                    text={selected.logoText}
                    color={selected.color}
                    className="size-10 shrink-0 rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-semibold">{selected.club}</p>
                    <p className="text-xs text-muted-foreground">{selected.senderTitle}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {selected.type} · {selected.fullDate}
                  </p>
                  <h2
                    ref={detailHeading}
                    tabIndex={-1}
                    className="oc-section-heading focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {selected.title}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNotificationsRead([selected.id], !selected.read)}
                  >
                    {selected.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                    {selected.read ? "Mark unread" : "Mark read"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => remove([selected.id])}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                {selected.body.map((paragraph, index) => (
                  <p
                    key={index}
                    className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
                {selected.locationChange && (
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="size-4" />
                      {selected.locationChange.newLocation}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Previously: {selected.locationChange.oldLocation}
                    </p>
                  </div>
                )}
                {!selected.href && (selected.eventId ||
                  selected.type === "Interview Invite" ||
                  selected.locationChange) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selected.eventId) focusEvent(selected.eventId)
                      onNavigate("calendar")
                    }}
                  >
                    <CalendarDays className="size-4" />
                    View calendar
                  </Button>
                )}
                {selected.taskHref && <Button variant="outline" asChild><Link href={selected.taskHref}>View task</Link></Button>}
                {selected.cta && selected.href && !selected.taskHref && <Button variant="outline" asChild><Link href={selected.href}>{selected.cta}</Link></Button>}
                {selected.cta && !selected.href && !selected.taskHref && selected.type !== "Interview Invite" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selected.clubId) focusApplication(selected.clubId)
                      onNavigate(trackedApps.some(app => app.clubId === selected.clubId && app.status === "Drafting") ? "tracker" : "status")
                    }}
                  >
                    {trackedApps.some(app => app.clubId === selected.clubId && app.status === "Drafting") ? "Continue application" : "View status"}
                  </Button>
                )}
              </div>
              <p className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
                {"Club updates stay here so you can return to them anytime."}
              </p>
            </>
          )}
        </section>
      </div>
      {!demo.isDemoEnabled && <CommunicationsInbox />}
    </div>
  )
}
