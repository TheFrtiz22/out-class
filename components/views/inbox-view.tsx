"use client"
import { schedulingDateTime } from "@/lib/scheduling-config"

import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { ReportContentButton } from "@/components/reports/report-content-button"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { CommunicationsInbox } from "@/components/communications-inbox"
import { useEffect, useMemo, useState, useRef } from "react"
import { Bell, Trash2, Mail, MailOpen, ArrowLeft, MapPin, CalendarDays, ChevronUp, ChevronDown, Clock } from "@/components/icons"
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
import { notificationCountLabel, notificationGroups, notificationPriority } from "@/lib/student-agenda"
import { toast } from "sonner"
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests"
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { pluralize } from "@/lib/copy/terms"
import { notificationRelativeTime, notificationTypeLabel } from "@/lib/notification-presentation"
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
      setReadingOrder([])
      setSelectedId(focusNotificationId)
      markNotificationRead(focusNotificationId)
      focusNotification(null)
    }
  }, [focusNotificationId, items, markNotificationRead, focusNotification])
  useEffect(() => {
    if (selectedId) detailHeading.current?.focus()
  }, [selectedId])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  // Checkboxes appear only while selecting; rows otherwise open on click and offer read/delete on hover.
  const [selecting, setSelecting] = useState(false)
  const [readingOrder, setReadingOrder] = useState<string[]>([])
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
  // Each heading counts its own rows; the Unread/Read tabs and filters narrow them first.
  const countLine = (list: typeof filtered) => <p className="oc-inbox-group-count">{notificationCountLabel(list)}</p>
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
  // Reading order for the previous/next controls: the rows as listed when a notification was opened from the
  // list. Opening marks it read, which can drop it from Unread or move it under "Unread first", so the order
  // is kept from that moment (minus deleted rows) rather than recomputed after each read.
  const listed = groups.flatMap((group) => group.items.map((item) => item.id))
  const sequence = readingOrder.filter((id) => items.some((item) => item.id === id))
  const order = selected && sequence.includes(selected.id) ? sequence : listed
  const position = selected ? order.indexOf(selected.id) : -1
  function open(id: string, keepOrder = false) {
    if (!keepOrder) setReadingOrder(listed)
    setSelectedId(id)
    markNotificationRead(id)
  }
  function toggleChecked(id: string) {
    setChecked((previous) => {
      const next = new Set(previous)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function stopSelecting() {
    setSelecting(false)
    setChecked(new Set())
  }
  function backToList() {
    const previous = selectedId
    setSelectedId(null)
    requestAnimationFrame(() => {
      if (previous)
        document
          .querySelector<HTMLButtonElement>(`[data-notification-id="${CSS.escape(previous)}"]`)
          ?.focus()
    })
  }
  // The first available follow-up is the primary action; any others stay secondary.
  const calendarAction = selected && !selected.href && (selected.eventId || selected.type === "Interview Invite" || selected.locationChange)
  const draftingApplication = selected ? trackedApps.some(app => app.clubId === selected.clubId && app.status === "Drafting") : false
  return (
    <div className="oc-inbox-workspace max-w-[var(--oc-content-width)] space-y-5 text-foreground">
      {invitations.length > 0 && <OrganizationOwnershipRequests enabled includeDismissed />}
      {showFilters && <div className="oc-toolbar">
          <SearchField aria-label="Search notifications" placeholder="Search notifications, clubs, or keywords" value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} containerClassName="min-w-0 flex-1 basis-60" />
          <SegmentedControl label="Read status" size="compact" value={readFilter} onChange={setReadFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: unread || undefined }, { value: "read", label: "Read" }]} />
          <FilterPopover title="Notification filters" align="end" count={[filter !== "All", club !== "all", sort !== "priority"].filter(Boolean).length}>
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
      </div>}
      <div className="oc-inbox-panes" data-reading={selected ? "" : undefined}>
        <section aria-label="Notification list" className="oc-inbox-list" data-selecting={selecting ? "" : undefined}>
          <div className="oc-inbox-list-bar">
            {selecting ? (
              <>
                <Checkbox
                  aria-label="Select all visible notifications"
                  checked={allChecked ? true : checkedIds.length > 0 ? "indeterminate" : false}
                  disabled={!filtered.length}
                  onCheckedChange={() =>
                    setChecked(allChecked ? new Set() : new Set(filtered.map((item) => item.id)))
                  }
                />
                <span className="oc-inbox-list-count" role="status">
                  {checkedIds.length ? `${checkedIds.length} selected` : "Select notifications"}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={stopSelecting}>Done</Button>
              </>
            ) : (
              <>
                <span className="oc-inbox-list-count" role="status">{pluralize(filtered.length, "result")}{unread ? ` · ${unread} unread` : ""}</span>
                <Button variant="ghost" size="sm" className="ml-auto" disabled={!unread} onClick={() => void markAllNotificationsRead()}>
                  <MailOpen className="size-4" /><span className="max-[400px]:sr-only">Mark all as read</span>
                </Button>
                <Button variant="ghost" size="sm" disabled={!filtered.length} onClick={() => setSelecting(true)}>Select</Button>
              </>
            )}
          </div>
          {!groups.length && <div className="oc-inbox-group-heading">
            <h3>Club updates</h3>
            {countLine(filtered)}
          </div>}
          <div className="oc-inbox-groups">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <div className="oc-inbox-group-heading">
                  <h3>{group.label}</h3>
                  {countLine(group.items)}
                </div>
                <ul className="oc-inbox-rows">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="oc-inbox-row"
                      data-selected={!selecting && selectedId === item.id ? "" : undefined}
                      data-unread={!item.read ? "" : undefined}
                      data-checked={checked.has(item.id) ? "" : undefined}
                    >
                      {selecting && (
                        <Checkbox
                          className="oc-inbox-row-check"
                          aria-label={`Select ${item.title}`}
                          checked={checked.has(item.id)}
                          onCheckedChange={() => toggleChecked(item.id)}
                        />
                      )}
                      <button
                        data-notification-id={item.id}
                        type="button"
                        aria-current={selectedId === item.id ? "true" : undefined}
                        tabIndex={selecting ? -1 : undefined}
                        onClick={() => (selecting ? toggleChecked(item.id) : open(item.id))}
                        className="oc-inbox-row-main"
                      >
                        <span aria-hidden="true" className="oc-inbox-dot" />
                        {!selecting && (
                          <ClubLogo
                            clubId={item.clubId}
                            logoUrl={item.logoUrl} marketing={item.marketing}
                            text={item.logoText}
                            color={item.color}
                            className="oc-inbox-avatar size-10 shrink-0 rounded-full text-xs"
                          />
                        )}
                        <span className="oc-inbox-row-text">
                          <span className="oc-inbox-row-top">
                            <span className="oc-inbox-club">{item.club}</span>
                            <time className="oc-inbox-time" dateTime={item.createdAt} title={item.fullDate} suppressHydrationWarning>
                              {notificationRelativeTime(item.createdAt, item.fullDate)}
                            </time>
                          </span>
                          <span className="oc-inbox-title">
                            {!item.read && <span className="sr-only">Unread: </span>}
                            {item.title}
                          </span>
                          <span className="oc-inbox-preview">{item.preview}</span>
                          <span className="oc-inbox-meta">
                            {item.urgent && <span className="oc-inbox-urgent"><Clock aria-hidden="true" />Urgent</span>}
                            <span>{notificationTypeLabel(item.type)}</span>
                          </span>
                        </span>
                      </button>
                      {!selecting && (
                        <div className="oc-inbox-quick">
                          <IconButton size="icon-sm" aria-label={item.read ? `Mark ${item.title} unread` : `Mark ${item.title} read`} onClick={() => setNotificationsRead([item.id], !item.read)}>
                            {item.read ? <Mail /> : <MailOpen />}
                          </IconButton>
                          <IconButton size="icon-sm" aria-label={`Delete ${item.title}`} onClick={() => remove([item.id])}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!filtered.length && (
              <EmptyState density="compact" icon={<Bell />}
                title={items.length ? "No matching notifications" : "No notifications yet"}
                description={items.length
                  ? "Your keyword or filters hide every notification."
                  : "Nothing has been sent to you yet. Choose which updates you want by email."}
                action={items.length
                  ? <Button size="sm" variant="outline" onClick={resetFilters}>Clear filters</Button>
                  : !demo.isDemoEnabled && <Button size="sm" variant="outline" asChild><Link href={notificationSettingsHref} scroll={false}>Notification settings</Link></Button>} />
            )}
          </div>
          {selecting && (
            <div className="oc-inbox-bulk" role="toolbar" aria-label="Selected notifications">
              <Button size="sm" variant="ghost" disabled={!checkedIds.length} onClick={() => { setNotificationsRead(checkedIds, true); setChecked(new Set()) }}>Mark read</Button>
              <Button size="sm" variant="ghost" disabled={!checkedIds.length} onClick={() => { setNotificationsRead(checkedIds, false); setChecked(new Set()) }}>Mark unread</Button>
              <Button size="sm" variant="ghost" disabled={!checkedIds.length} onClick={() => remove(checkedIds)} className="text-destructive"><Trash2 className="size-4" />Delete</Button>
            </div>
          )}
        </section>
        <section aria-label="Notification details" className="oc-inbox-reader oc-detail-panel">
          {!selected ? (
            <div className="oc-inbox-reader-empty">
              <p>Nothing selected</p>
              <span>Choose a notification to read it here.</span>
            </div>
          ) : (
            <>
              <div className="oc-inbox-reader-bar">
                <Button variant="ghost" size="sm" className="oc-inbox-back" onClick={backToList}>
                  <ArrowLeft className="size-4" />
                  Inbox
                </Button>
                <IconButton size="icon-sm" aria-label="Previous notification" disabled={position <= 0} onClick={() => open(order[position - 1], true)}><ChevronUp /></IconButton>
                <IconButton size="icon-sm" aria-label="Next notification" disabled={position < 0 || position >= order.length - 1} onClick={() => open(order[position + 1], true)}><ChevronDown /></IconButton>
                {position >= 0 && <span className="oc-inbox-position">{position + 1} of {order.length}</span>}
                <span className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => setNotificationsRead([selected.id], !selected.read)}>
                  {selected.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                  <span className="max-sm:sr-only">{selected.read ? "Mark unread" : "Mark read"}</span>
                </Button>
                <IconButton size="icon-sm" aria-label="Delete" onClick={() => remove([selected.id])}><Trash2 /></IconButton>
              </div>
              <div key={selected.id} className="oc-inbox-reader-body">
                <div className="oc-inbox-sender">
                  <ClubLogo
                    clubId={selected.clubId}
                    logoUrl={selected.logoUrl} marketing={selected.marketing}
                    text={selected.logoText}
                    color={selected.color}
                    className="oc-inbox-avatar size-11 shrink-0 rounded-full text-sm"
                  />
                  <div>
                    <p className="text-sm font-semibold">{selected.club}</p>
                    <p className="text-xs text-muted-foreground">{selected.senderTitle}</p>
                  </div>
                </div>
                <div>
                  <p className="oc-inbox-kind">
                    {selected.urgent && <span className="oc-inbox-urgent"><Clock aria-hidden="true" />Urgent</span>}
                    <span>{notificationTypeLabel(selected.type)} · {selected.fullDate}</span>
                  </p>
                  <h2 ref={detailHeading} tabIndex={-1} className="oc-inbox-reader-title">
                    {selected.title}
                  </h2>
                </div>
                <div className="oc-inbox-reader-content">
                  {selected.body.map((paragraph, index) => {
                    // Schedules arrive one slot per line; they read as a list rather than a run-on paragraph.
                    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean)
                    return selected.type === "Interview Invite" && lines.length > 1 ? (
                      <ul key={index} className="oc-inbox-lines">
                        {lines.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
                      </ul>
                    ) : (
                      <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>
                    )
                  })}
                  {selected.locationChange && (
                    <div className="oc-inbox-callout">
                      <p className="flex items-center gap-2 font-semibold">
                        <MapPin className="size-4" />
                        {selected.locationChange.newLocation}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Previously: {selected.locationChange.oldLocation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="oc-inbox-reader-actions">
                {selected.announcementId && <ReportContentButton target={{ type: "announcement", id: selected.announcementId }} label="Report announcement" hidden={selected.ownAnnouncement} className="mr-auto self-center" />}
                {calendarAction && (
                  <Button
                    variant={selected.taskHref || selected.cta ? "outline" : "default"}
                    onClick={() => {
                      if (selected.eventId) focusEvent(selected.eventId)
                      onNavigate("calendar")
                    }}
                  >
                    <CalendarDays className="size-4" />
                    View calendar
                  </Button>
                )}
                {selected.taskHref && <Button asChild><Link href={selected.taskHref}>View task</Link></Button>}
                {selected.cta && selected.href && !selected.taskHref && <Button asChild><Link href={selected.href}>{selected.cta}</Link></Button>}
                {selected.cta && !selected.href && !selected.taskHref && selected.type !== "Interview Invite" && (
                  <Button
                    onClick={() => {
                      if (selected.clubId) focusApplication(selected.clubId)
                      onNavigate(draftingApplication ? "tracker" : "status")
                    }}
                  >
                    {draftingApplication ? "Continue application" : "View status"}
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {!demo.isDemoEnabled && <CommunicationsInbox />}
    </div>
  )
}
