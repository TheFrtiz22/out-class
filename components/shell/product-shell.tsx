"use client"
import { LoadingState } from "@/components/ui/loading-state"
import { accountInitials } from "@/lib/profile-photo"
import { AccountAvatar } from "@/components/account-avatar"
import { DemoMenuItems } from "@/components/demo-controls"
import { NavigationRail } from "@/components/shell/navigation-rail"
import "./responsive-workspace.css"
import "./authenticated-product.css"
import "./floating-header.css"
import "./floating-dock.css"
import { NotificationCenter } from "@/components/shell/notification-center"
import { startCommunicationsLive } from "@/lib/communications-live"
import { inboxRealtime } from "@/lib/inbox-realtime"
import { FloatingSearchTrigger } from "@/components/shell/floating-header-controls"
import { MobileNavigation } from "@/components/shell/mobile-navigation"
import { TutorialWalkthrough } from "@/components/tutorial-walkthrough"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react"
import { Bell, Menu, UserRound, LogOut, Home, Users2, Compass, Bookmark, CalendarDays, FileText, ListChecks, CheckCircle2, Settings, Megaphone, Shield, SlidersHorizontal, Video, RefreshCw, Gauge, Gavel, IdCard } from "@/components/icons"
import { toast } from "sonner"
import { OutClassLogo } from "@/components/outclass-logo"
import { WorkspaceSelector, useWorkspaceOptions } from "@/components/shell/workspace-selector"
import { productRouteAccount, rememberProductRoute } from "@/components/shell/focus-frame-context"
import { useWorkspaceAccess } from "@/components/shell/use-workspace-access"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { ClubWorkspaceSwitcher } from "@/components/club-workspace-switcher"
import { NavigationSearch } from "@/components/shell/navigation-search"
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts"
import { IconButton } from "@/components/ui/icon-button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getTaskNotifications } from "@/lib/workspace-api"
import { getDurableNotifications } from "@/lib/workspace-read"
import { useApplicationState } from "@/lib/application-state"
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context"
import { studentNav, adminNav, type ViewId } from "@/lib/views"
import { canLeaveWorkspace, clubSearchLinks, type ProductNavItem } from "@/lib/product-navigation"
import { activeNavItem, bottomBarItems, moreSections, railItems, workspaceOptionName, type RailSection } from "@/lib/navigation"
import { hasPermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { handleClubLink } from "@/lib/workspace-navigation"
import { TERMS } from "@/lib/copy/terms"
import { countShellStart } from "@/lib/shell-metrics"
import { notificationSettingsHref } from "@/lib/settings-navigation"
import { RouteChildren } from "@/components/route-content"
import { prepareSignOut, sealAutosaveDraftsForSignOut } from "@/lib/autosave-store"
import { flushEditors } from "@/lib/autosave-navigation"
import { useConfirm } from "@/components/ui/confirm-dialog"

/**
 * Rail icons. Club workspace items each get a distinct glyph: Overview (gauge) vs Home (house), Applicants
 * (ID card) vs Members (people), one Calendar, and Decide (gavel). Exported for the phone bar.
 */
export const navigationIcons: Record<string, typeof Home> = { rejected: IdCard, resumes: FileText, reviews: FileText, users: Users2, reports: FileText, events: CalendarDays, claims: Shield, "school-requests": FileText, onboarding: Users2, support: Shield, activity: FileText, permissions: Shield, audit: FileText, "student-dashboard": Home, "club-home": Home, "club-meetings": CalendarDays, "club-tasks": ListChecks, explore: Compass, categories: Compass, status: CheckCircle2, inbox: Bell, "student-profile": UserRound, corkboard: Bookmark, calendar: CalendarDays, applications: FileText, interviews: Video, decisions: Gavel, clubs: Users2, overview: Gauge, meetings: CalendarDays, tasks: ListChecks, applicants: IdCard, members: Users2, announcements: Megaphone, settings: Settings, rounds: Shield, rules: SlidersHorizontal, cycles: RefreshCw, recruiting: FileText }

/**
 * One shell for every workspace. `sections` come from lib/navigation; the highlighted
 * item is derived from the URL there too, with `active` only as a fallback for pages
 * that no URL describes (the signed-out local preview).
 */
/** Phones hide the pill; the account menu then lists workspaces. Rendered only there, so menu keys and typeahead never reach hidden items. */
const PHONE_QUERY = "(max-width: 759px)"
function subscribePhone(callback: () => void) {
  const media = window.matchMedia(PHONE_QUERY)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}
function usePhoneLayout() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false)
}

export function ProductShell({ children, mode, sections, active, title, clubId = "", clubName, manager = false, workspaceKind, chrome = true, onSelect, onNavigate, onModeSelect }: {
  workspaceKind?: "admin";
  /** False hides the header, rail and bottom bar with CSS; the tree (and every running job) stays mounted. */
  chrome?: boolean;
  /** Remembers whether a leader last used Recruiting or Club, for the next workspace entry. */
  onModeSelect?: (id: "recruiting" | "club") => void;
  children: ReactNode; mode: string; sections: RailSection[]; active: string; title: string;
  clubId?: string; clubName?: string; manager?: boolean; onSelect: (id: string) => void; onNavigate: (view: ViewId) => void;
}) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const { user, isImpersonating } = useAuth(), demo = useDemoMode(), { notifications, syncTaskNotifications, syncDurableNotifications, durableUnread } = useApplicationState()
  const [mobile, setMobile] = useState(false), [search, setSearch] = useState(false), [signingOut, setSigningOut] = useState(false)
  const confirmSignOut = useConfirm()
  async function signOut() {
    // Try to save unsaved edits first; only a confirmed discard clears this device's copies.
    const outcome = await prepareSignOut({ flush: flushEditors, confirm: () => confirmSignOut({ title: "Sign out and discard unsaved changes?", description: "Some changes have not reached OutClass yet. Signing out removes them from this device.", confirmLabel: "Discard and sign out", tone: "danger" }) })
    if (outcome === "cancel" || (outcome !== "discard" && !canLeaveWorkspace())) return
    setSigningOut(true)
    try {
      await import("@/lib/push-device").then(async ({ unsubscribeOnSignOut }) => unsubscribeOnSignOut((await import("@/actions/push-subscriptions")).removePushSubscription)).catch(() => {})
      const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw Error("Could not sign out.")
      const { createClient } = await import("@/utils/supabase/client"); const { error } = await createClient().auth.signOut(); if (error) throw error
      sealAutosaveDraftsForSignOut(); window.location.assign("/")
    } catch { toast.error("Could not sign out. Try again."); setSigningOut(false) }
  }
  const current = (pathname ? activeNavItem(pathname, new URLSearchParams(params?.toString()), { member: !manager && !!clubId }) : null) ?? active
  const contextKey = `${clubId}:${mode}:${current}`
  const main = useRef<HTMLElement>(null), previous = useRef(contextKey), moved = useRef(false)
  const mobileOrigin = useRef<HTMLElement | null>(null)
  const searchOrigin = useRef<HTMLElement | null>(null)
  const [taskLoad, setTaskLoad] = useState({ loading: false, failed: false })
  const [durableLoad, setDurableLoad] = useState({ loading: false, failed: false })
  const access = useWorkspaceAccess()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const platform = workspaceKind === "admin"
  const workspace = platform ? "admin" : manager ? "leader" : "personal"
  const allowed = platform ? access.admin : manager ? access.clubs.some(member => member.clubId === clubId) : true
  const fallbackHref = manager && !platform && access.clubs[0] ? clubWorkspaceHref(access.clubs[0].clubId) : "/home"
  useEffect(() => {
    if (access.pending || allowed) return
    // Access loss is mandatory reconciliation, not a voluntary leave-page action.
    if (platform || manager) router.replace(fallbackHref)
  }, [access.pending, allowed, platform, manager, fallbackHref, router])
  const workspaceChoices = useWorkspaceOptions(access, clubId)
  // A focus screen's Exit returns to the last product page (same tab only).
  useEffect(() => { if (mode !== "preview") rememberProductRoute(productRouteAccount(user?.id, demo.isDemoEnabled)) })
  const searchItems = !allowed ? [] : platform ? [] : manager ? adminNav.filter(item => {
    // Applicants is searchable through its rail destination ("All Applicants"); one entry per place.
    if (item.id === "leader-dashboard") return false
    if (item.id === "interview-workspace") return hasPermission(member, "applications.review")
    if (item.id === "interview-scheduler") return hasPermission(member, "interviews.manage") || hasPermission(member, "applications.review")
    if (item.id === "broadcast-messages") return hasPermission(member, "meetings.manage")
    return hasPermission(member, "club.settings")
  }) : [...studentNav.filter(i => i.id !== "student-profile"), { id: "my-clubs" as const, title: "My Clubs", icon: Users2 }]
  const userId = user?.id
  useEffect(() => {
    if (!userId || demo.isDemoEnabled) return
    let active = true, running = false, again = false
    countShellStart("task-poll")
    setTaskLoad({ loading: true, failed: false })
    const refresh = async () => {
      if (running) { again = true; return }
      running = true
      try { const items = await getTaskNotifications(); if (active) { syncTaskNotifications(items, userId); setTaskLoad({ loading: false, failed: false }) } }
      catch { if (active) setTaskLoad({ loading: false, failed: true }) }
      finally { running = false; if (again && active) { again = false; void refresh() } }
    }
    refresh()
    // Hidden tabs skip the poll; focus refreshes as soon as the student returns.
    const timer=setInterval(()=>{ if (document.visibilityState !== "hidden") void refresh() },60000)
    window.addEventListener("focus",refresh);window.addEventListener("outclass:tasks-changed",refresh)
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("outclass:tasks-changed",refresh)}
  }, [userId, demo.isDemoEnabled, syncTaskNotifications])
  useEffect(() => {
    if (!userId || demo.isDemoEnabled) return
    let active = true, running = false, again = false
    setDurableLoad({ loading: true, failed: false })
    const refresh = async () => {
      if (running) { again = true; return }
      running = true
      try { const data = await getDurableNotifications(); if (active) { syncDurableNotifications(data); setDurableLoad({ loading: false, failed: false }) } }
      catch { if (active) setDurableLoad({ loading: false, failed: true }) }
      finally { running = false; if (again && active) { again = false; void refresh() } }
    }
    void refresh()
    countShellStart("communications-live")
    const stop = startCommunicationsLive({ streamAllowed: !isImpersonating, openRealtime: inboxRealtime(userId), changed: () => { void refresh(); window.dispatchEvent(new Event("outclass:communications-refresh")) } })
    return () => { active = false; stop() }
  }, [userId, demo.isDemoEnabled, isImpersonating, syncDurableNotifications])
  const unread = notifications.filter(n => !n.durableId && !n.read).length + (demo.isDemoEnabled ? 0 : durableUnread)
  const { invitations } = useOrganizationInvitations()
  const pendingInvitations = invitations.length
  const name = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user?.email || "Your account"
  useEffect(() => {
    document.title = `${title} · OutClass`
    if (previous.current !== contextKey) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); previous.current = contextKey }
  }, [contextKey, title])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const close = () => { if (media.matches) setMobile(false) }
    media.addEventListener("change", close)
    return () => media.removeEventListener("change", close)
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"][data-state="open"]:not(.oc-notification-panel)')) { e.preventDefault(); searchOrigin.current = document.activeElement as HTMLElement; setSearch(true) }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  function select(id: string) {
    if (!canLeaveWorkspace()) return
    moved.current = true; setMobile(false)
    if (id === "settings") router.push("/settings")
    else onSelect(id)
  }
  function navigate(view: ViewId) { if (canLeaveWorkspace()) onNavigate(view) }
  function navLink(item: ProductNavItem, dock = false) {
    const selected = item.id === current
    const className = cn("flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring w-full text-left", selected ? "bg-accent font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")
    const NavIcon = navigationIcons[item.id] ?? FileText
    const content = <>{(dock ? <span className="oc-dock-icon">{<NavIcon weight={selected ? "fill" : "regular"} aria-hidden="true" size={24} />}</span> : <NavIcon weight={selected ? "fill" : "regular"} aria-hidden="true" className="size-4 shrink-0" />)}<span className="oc-dock-item-label">{item.label}</span>{item.preview && <span className="oc-dock-preview ml-auto text-[length:var(--oc-size-10)] font-normal text-muted-foreground">Preview</span>}</>
    const element = item.href ? <Link key={item.id} data-dock-item={dock || undefined} data-tour={`nav-${item.id}`} aria-label={item.label} href={item.href} prefetch={clubId && item.href.split("?")[0] === `/club/${clubId}/workspace` ? false : undefined} aria-current={selected ? "page" : undefined} className={className} onClick={e => { if (!canLeaveWorkspace()) e.preventDefault(); else { if (item.mode && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) onModeSelect?.(item.mode); moved.current = true; setMobile(false); handleClubLink(e, item.href!) } }}>{content}</Link> : <button key={item.id} data-dock-item={dock || undefined} data-tour={`nav-${item.id}`} aria-label={item.label} type="button" aria-current={selected ? "page" : undefined} className={className} onClick={() => select(item.id)}>{content}</button>
    return element
  }
  // Account settings need a live session; the demo and signed-out preview hide them.
  const railSections = !allowed ? [] : sections.map(section => ({ ...section, items: section.items.filter(item => item.href !== "/settings" || !!user && !demo.isDemoEnabled) })).filter(section => section.items.length)
  const bar = allowed ? bottomBarItems(railSections, mode === "preview" ? "preview" : workspace, current) : []
  /** Phone "More" sheet: a club workspace lists every rail item the bar doesn't show directly; elsewhere, every rail section. */
  const sheetSections = workspace === "leader" && mode !== "preview" ? moreSections(railSections, bar) : railSections
  function sidebar() { return <div className="oc-context-sidebar flex h-full flex-col overflow-y-auto px-4 py-6">
    <button type="button" className="oc-rail-brand" aria-label="OutClass home" onClick={() => navigate("student-dashboard")}><OutClassLogo variant="dark" /></button>
    {sheetSections.map(section => <div key={section.id} className="oc-sheet-section mb-5" data-tour={section.tour}>
      {section.label && <p className="mb-2 px-3 text-[length:var(--oc-size-11)] text-muted-foreground">{section.label}</p>}
      <nav aria-label={section.label ?? section.name} className="space-y-1">{section.items.filter(i => !i.hidden).map(item => navLink(item))}</nav>
    </div>)}
  </div> }
  const railLinks = railItems(railSections).filter(item => item.href).map(item => ({ id: item.id, title: item.id === "overview" && item.mode === "recruiting" ? TERMS.recruiting : item.label, href: item.href! }))
  // Meetings, Events and Members of this club, each only when its page would open; one entry per address.
  const clubLinks = allowed && !platform ? clubSearchLinks(member, clubId).filter(link => !railLinks.some(rail => rail.href === link.href)) : []
  const otherClubs = manager && !platform ? access.clubs.filter(club => club.clubId !== clubId) : []
  return <div className="min-h-dvh bg-background text-foreground" data-product-shell={platform ? "admin" : manager ? "manager" : "personal"} data-shell-chrome={chrome ? undefined : "hidden"} style={{ "--oc-club-accent": member?.club.color || "var(--brand-orange)" } as CSSProperties}>
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-card focus:p-3">Skip to content</a>
    <header className="oc-product-header">
      <div className="oc-product-header-row">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><IconButton aria-label="Open navigation" className="oc-floating-circle oc-floating-drawer"><Menu /></IconButton></SheetTrigger><SheetContent side="left" className="oc-navigation-sheet w-[min(88vw,300px)] p-0" onCloseAutoFocus={e => { if (moved.current) { e.preventDefault(); main.current?.focus(); moved.current = false; mobileOrigin.current = null } else if (mobileOrigin.current?.isConnected) { e.preventDefault(); mobileOrigin.current.focus(); mobileOrigin.current = null } }}><SheetTitle className="oc-modal-title sr-only">Workspace navigation</SheetTitle><SheetDescription className="sr-only">Every section of this workspace.</SheetDescription>{sidebar()}</SheetContent></Sheet>
        {/* Phones, as in the app: the logo leads the header, unless the mini workspace pill takes its place. */}
        <button type="button" className="oc-product-brand" aria-label="OutClass home" onClick={() => navigate("student-dashboard")}><OutClassLogo className="h-7" /></button>
        <div className="oc-product-workspaces"><WorkspaceSelector access={access} current={workspace} clubId={clubId} clubSwitcher={manager && !platform && allowed && <ClubWorkspaceSwitcher clubId={clubId} access={access} />} /></div>
        <div className="oc-product-utilities">
          <FloatingSearchTrigger open={search} onOpen={trigger => { searchOrigin.current = trigger; setSearch(true) }} />
          <NotificationCenter unread={unread} pendingInvitations={pendingInvitations} loadState={{ loading: !!userId && !demo.isDemoEnabled && (taskLoad.loading || durableLoad.loading), failed: !!userId && !demo.isDemoEnabled && (taskLoad.failed || durableLoad.failed) }} onRetry={() => {
            setTaskLoad({ loading: true, failed: false }); setDurableLoad({ loading: true, failed: false })
            window.dispatchEvent(new Event("outclass:tasks-changed")); window.dispatchEvent(new Event("outclass:communications-changed"))
          }} onNavigate={onNavigate} />
          <DropdownMenu><DropdownMenuTrigger asChild><IconButton data-tour="profile" className="oc-floating-circle oc-floating-profile" aria-label={`Account menu for ${name}, ${accountInitials(user)}`}><AccountAvatar user={user} /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="oc-floating-account-menu w-64"><p className="truncate px-2 py-2 text-sm font-medium">{name}</p>{user && !isImpersonating && <DemoMenuItems />}{/* The account menu switches workspace at every width; the header pill is an extra shortcut on wider screens. */}{workspaceChoices.length > 1 && <div className="oc-account-workspaces" role="group" aria-label="Workspaces"><DropdownMenuSeparator /><p className="px-2 pb-1 pt-2 text-[length:var(--oc-size-11)] text-muted-foreground">Workspace</p>{workspaceChoices.map(option => <DropdownMenuItem key={option.id} aria-current={option.id === workspace ? "page" : undefined} aria-label={workspaceOptionName(option)} onSelect={() => { if (option.id !== workspace && canLeaveWorkspace()) router.push(option.href) }}><span className="min-w-0 flex-1 truncate">{option.label}</span>{option.id === workspace && <CheckCircle2 weight="fill" aria-hidden="true" />}</DropdownMenuItem>)}{otherClubs.map(club => <DropdownMenuItem key={club.clubId} aria-label={`${club.club.name} club workspace`} onSelect={() => { if (canLeaveWorkspace()) router.push(clubWorkspaceHref(club.clubId)) }}><span className="min-w-0 flex-1 truncate">{club.club.name}</span></DropdownMenuItem>)}</div>}<DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("student-profile")}><AccountAvatar user={user} className="size-5" />Your profile</DropdownMenuItem>{user && !demo.isDemoEnabled && <DropdownMenuItem onSelect={() => { if (canLeaveWorkspace()) router.push("/settings") }}><Settings />Settings</DropdownMenuItem>}{user && !demo.isDemoEnabled && !isImpersonating && <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}><LogOut />Sign out</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </div>
    </header>
    <div><NavigationRail sections={railSections} active={current} renderItem={(item, surface) => navLink(item, surface === "rail")} onHome={() => navigate("student-dashboard")} /><main data-tour="workspace" id="workspace-content" ref={main} tabIndex={-1} aria-label={title} className="oc-workspace-content w-full min-w-0 max-w-[var(--oc-content-width)] outline-none">
      {!allowed ? <LoadingState label="Checking workspace access…" layout="inline" rows={3} /> : <>{demo.isDemoEnabled && <p className="oc-demo-note mb-6 text-xs text-muted-foreground">Fictional demo data · changes stay in this browser; no messages are sent.</p>}<RouteChildren>{children}</RouteChildren></>}
    </main></div>
    <MobileNavigation items={bar} active={current} onSelect={select} onLink={event => { if (!canLeaveWorkspace()) event.preventDefault() }} onMore={() => { mobileOrigin.current = document.activeElement as HTMLElement; setMobile(true) }} />
    {/* No key: the walkthrough stays mounted across navigation and reloads only when its experience or club changes. */}
    {user && !platform && allowed && <TutorialWalkthrough experience={manager ? "leader" : "student"} clubId={manager ? clubId : undefined} preview={user.impersonating} onOpenStep={step => {
      if (!canLeaveWorkspace()) return
      if ("view" in step) navigate(step.view)
      else router.push(`/club/${encodeURIComponent(clubId)}/workspace?section=${step.section}${step.tool ? `&tool=${step.tool}` : ""}`)
    }} />}
    <KeyboardShortcuts />
    <NavigationSearch clubId={manager ? clubId : undefined} leader={manager} open={search} onOpenChange={setSearch} onDismissAutoFocus={() => {
      const origin = searchOrigin.current
      if (origin?.isConnected && origin !== document.body) origin.focus({ preventScroll: true })
      else document.querySelector<HTMLButtonElement>(".oc-global-search")?.focus({ preventScroll: true })
    }} items={[...searchItems, { id: "inbox", title: TERMS.inbox, icon: Bell }, { id: "student-profile", title: "Profile", icon: UserRound }]} links={[...railLinks, ...clubLinks, ...(platform ? [] : [{ id: "settings", title: "Settings", href: "/settings" }]), ...(platform || !user || demo.isDemoEnabled ? [] : [{ id: "notification-settings", title: "Notification settings", href: notificationSettingsHref }])]} onNavigate={onNavigate} />
  </div>
}
