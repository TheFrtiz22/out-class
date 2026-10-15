"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Bell, Maximize2, CheckCheck, Check, Mail, Archive, MoreHorizontal, ArrowLeft, ArrowUpRight, CalendarDays, FileText, Megaphone, ListChecks, Users2 } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { OrganizationInvitationCard } from "@/components/organization-invitation-card"
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context"
import { useApplicationState } from "@/lib/application-state"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { notificationDestination, notificationFeed, notificationRelativeTime } from "@/lib/notification-presentation"
import type { Notification } from "@/lib/data"
import type { ViewId } from "@/lib/views"
import "./notification-center.css"

const icons = { Announcement: Megaphone, "Interview Invite": CalendarDays, "Application Update": FileText, "Club Invitation": Users2, Task: ListChecks, "Decision Available": FileText, "Offer Confirmation": CheckCheck, "OutClass Update": Bell, "Private Message": Mail }

type LoadState = { loading: boolean; failed: boolean }
export function NotificationCenter({ unread, pendingInvitations, loadState, onRetry, onNavigate }: {
  unread: number
  pendingInvitations: number
  loadState: LoadState
  onRetry: () => void
  onNavigate: (view: ViewId) => void
}) {
  const state = useApplicationState()
  const invitations = useOrganizationInvitations()
  const [open, setOpen] = useState(false), [filter, setFilter] = useState<"all" | "unread">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<{ retry: () => void } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const working = useRef(false), navigated = useRef(false), outside = useRef(false)
  const bell = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), selectedHeading = useRef<HTMLHeadingElement>(null)
  const filterButton = useRef<HTMLButtonElement>(null)
  const feed = notificationFeed(state.notifications, filter === "unread")
  const selected = state.notifications.find(item => item.id === selectedId)
  const count = unread + pendingInvitations
  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [open])
  const selectedKey = selected?.id
  useEffect(() => { if (selectedKey) selectedHeading.current?.focus({ preventScroll: true }) }, [selectedKey])

  function leave(action: () => void) {
    if (!canLeaveWorkspace()) return false
    navigated.current = true
    setOpen(false); setSelectedId(null)
    action()
    return true
  }
  function expand() { leave(() => onNavigate("inbox")) }
  async function run(action: () => Promise<boolean>) {
    if (working.current) return
    working.current = true; setBusy(true); setActionError(null)
    try { if (await action() === false) throw Error("Notification action failed") }
    catch { setActionError({ retry: () => { void run(action) } }) }
    finally {
      working.current = false; setBusy(false)
      requestAnimationFrame(() => {
        if (panel.current && (document.activeElement === document.body || !document.activeElement?.isConnected)) filterButton.current?.focus({ preventScroll: true })
      })
    }
  }
  function read(item: Notification) { if (!item.read) void run(() => state.markNotificationRead(item.id)) }
  function activate(item: Notification) {
    const destination = notificationDestination(item, state.trackedApps)
    if (destination.kind === "detail") { setSelectedId(item.id); read(item); return }
    if (destination.kind === "calendar") leave(() => { if (destination.eventId) state.focusEvent(destination.eventId); read(item); onNavigate("calendar") })
    if (destination.kind === "application") leave(() => { state.focusApplication(destination.clubId); read(item); onNavigate(destination.view) })
  }
  function back() { setSelectedId(null); requestAnimationFrame(() => filterButton.current?.focus({ preventScroll: true })) }
  function itemContent(item: Notification) {
    const Icon = icons[item.type]
    return <><span className="oc-notification-icon" aria-hidden="true"><Icon size={18} /></span><span className="oc-notification-copy"><span className="oc-notification-item-title">{item.title}</span><span className="oc-notification-preview">{item.preview}</span><span className="oc-notification-meta"><span>{item.club}</span><time dateTime={item.createdAt} title={item.fullDate}>{notificationRelativeTime(item.createdAt, item.timestamp, now)}</time></span></span>{!item.read && <span className="oc-notification-dot"><span className="sr-only">Unread</span></span>}</>
  }
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { navigated.current = false; outside.current = false } else setSelectedId(null) }}>
    <PopoverTrigger asChild><IconButton tabIndex={0} ref={bell} data-tour="notifications" className="oc-floating-circle" aria-label={count ? `Notifications, ${unread} unread${pendingInvitations ? `, ${pendingInvitations} pending invitation${pendingInvitations === 1 ? "" : "s"}` : ""}` : "Notifications"}><Bell />{count > 0 && <span className="oc-floating-unread" aria-hidden="true" />}</IconButton></PopoverTrigger>
    <PopoverContent ref={panel} className="oc-notification-panel" align="end" side="bottom" sideOffset={12} collisionPadding={12} sticky="always" aria-label="Notifications" onOpenAutoFocus={event => { event.preventDefault(); panel.current?.focus({ preventScroll: true }) }} onInteractOutside={() => { outside.current = true }} onEscapeKeyDown={() => { outside.current = false }} onCloseAutoFocus={event => {
      event.preventDefault()
      if (!navigated.current && !outside.current) bell.current?.focus({ preventScroll: true })
    }}>
      <header className="oc-notification-header"><h2>Notifications{count > 0 && <span className="oc-notification-count" aria-label={`${count} unread updates and pending invitations`}>{count}</span>}</h2><div className="oc-notification-header-actions"><button tabIndex={0} type="button" aria-label="Mark all updates as read" title="Mark all updates as read. Pending invitations still require a response." disabled={!unread || busy || loadState.loading} onClick={() => void run(state.markAllNotificationsRead)}><CheckCheck size={18} aria-hidden="true" /></button><button tabIndex={0} type="button" aria-label="Expand notifications" title="Expand notifications" onClick={expand}><Maximize2 size={17} aria-hidden="true" /></button></div></header>
      <div className="oc-notification-filter" role="group" aria-label="Filter notifications" data-filter={filter}><span aria-hidden="true" />{(["all", "unread"] as const).map(value => <button tabIndex={0} ref={value === filter ? filterButton : undefined} key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setSelectedId(null) }}>{value === "all" ? "All" : "Unread"}</button>)}</div>
      {actionError && <div className="oc-notification-error" role="alert"><span>Couldn’t update notifications.</span><button tabIndex={0} type="button" disabled={busy} onClick={actionError.retry}>Retry</button></div>}
      <div className="oc-notification-feed" aria-label="Notification feed" aria-busy={loadState.loading || busy}>
        {loadState.failed && <div className="oc-notification-error" role="alert"><span>Couldn’t load updates. Showing saved updates.</span><button tabIndex={0} type="button" onClick={onRetry}>Retry</button></div>}
        {selected ? <article className="oc-notification-detail"><button tabIndex={0} type="button" className="oc-notification-back" onClick={back}><ArrowLeft size={16} aria-hidden="true" />Back</button><p className="oc-notification-meta">{selected.club}</p><h3 ref={selectedHeading} tabIndex={-1}>{selected.title}</h3>{selected.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{selected.locationChange && <p>Updated location: {selected.locationChange.newLocation}<br />Previously: {selected.locationChange.oldLocation}</p>}<button tabIndex={0} type="button" className="oc-notification-text-action" disabled={busy} onClick={() => void run(() => state.setNotificationsRead([selected.id], !selected.read))}>{selected.read ? "Mark unread" : "Mark read"}</button>{selected.durableId && <button tabIndex={0} type="button" className="oc-notification-text-action" disabled={busy} onClick={() => void run(async () => { const success = await state.deleteNotifications([selected.id]); if (success) setSelectedId(null); return success })}>Dismiss</button>}</article> : <>
          {(invitations.invitations.length > 0 || invitations.failed) && <section className="oc-notification-invitations" aria-label="Pending invitations"><p>Invitations await your response</p>{invitations.failed && <div className="oc-notification-error" role="alert"><span>Couldn’t check invitations.</span><button tabIndex={0} type="button" onClick={invitations.refresh}>Retry</button></div>}<ul>{invitations.invitations.map(invitation => <OrganizationInvitationCard key={invitation.id} invitation={invitation} onChanged={invitations.changed} allowDecline compact tabIndex={0} />)}</ul></section>}
          {loadState.loading && !state.notifications.length && <div className="oc-notification-skeletons" role="status"><span className="sr-only">Loading notifications…</span>{[0, 1, 2].map(i => <div className="oc-notification-skeleton" key={i}><span /><span /></div>)}</div>}
          <ul className="oc-notification-items">{feed.map(item => {
            const destination = notificationDestination(item, state.trackedApps)
            return <li key={item.id} data-notification-id={item.id} data-unread={!item.read}><div className="oc-notification-row">{destination.kind === "href" ? <Link tabIndex={0} aria-disabled={busy} className="oc-notification-open" href={destination.href} prefetch={false} onClick={event => {
              if (busy || !canLeaveWorkspace()) { event.preventDefault(); return }
              read(item)
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { navigated.current = true; setOpen(false) }
            }}>{itemContent(item)}<span className="sr-only">{item.cta || "Open update"}</span></Link> : <button tabIndex={0} type="button" disabled={busy} className="oc-notification-open" onClick={() => activate(item)}>{itemContent(item)}</button>}
              <DropdownMenu><DropdownMenuTrigger asChild><button tabIndex={0} type="button" className="oc-notification-more" aria-label={`Actions for ${item.title}`} disabled={busy}><MoreHorizontal size={18} aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent className="oc-notification-item-menu" align="end" collisionPadding={12} onCloseAutoFocus={event => { if (!panel.current?.querySelector(`[data-notification-id="${CSS.escape(item.id)}"]`)) { event.preventDefault(); filterButton.current?.focus({ preventScroll: true }) } }}><DropdownMenuItem onSelect={() => void run(() => state.setNotificationsRead([item.id], !item.read))}>{item.read ? <Mail /> : <Check />}{item.read ? "Mark unread" : "Mark read"}</DropdownMenuItem>{item.durableId && <DropdownMenuItem onSelect={() => void run(() => state.deleteNotifications([item.id]))}><Archive />Dismiss</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
            </div></li>
          })}</ul>
          {!feed.length && !invitations.invitations.length && !loadState.loading && !invitations.loading && !loadState.failed && !invitations.failed && <div className="oc-notification-empty"><CheckCheck size={24} aria-hidden="true" /><p>You’re all caught up</p><span>{filter === "unread" ? "No unread updates. Your history is in All." : "New updates will appear here."}</span></div>}
        </>}
      </div>
      <footer><button tabIndex={0} type="button" onClick={expand}>View all notifications<ArrowUpRight size={15} aria-hidden="true" /></button></footer>
    </PopoverContent>
  </Popover>
}
