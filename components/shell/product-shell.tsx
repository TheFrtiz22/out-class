"use client"
import { AccountAvatar } from "@/components/account-avatar"
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation"
import "./responsive-workspace.css"
import "./authenticated-product.css"
import "./floating-header.css"
import { NotificationCenter } from "@/components/shell/notification-center"
import { FloatingModeNavigation, FloatingSearchTrigger } from "@/components/shell/floating-header-controls"
import { MobileNavigation } from "@/components/shell/mobile-navigation"
import { TutorialWalkthrough } from "@/components/tutorial-walkthrough"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { Bell, Menu, UserRound, LogOut, Home, Users2, Compass, Bookmark, CalendarDays, FileText, ListChecks, CheckCircle2, Settings, Megaphone, Shield, SlidersHorizontal, Video } from "lucide-react"
import { toast } from "sonner"
import { OutClassLogo } from "@/components/outclass-logo"
import { ClubWorkspaceSwitcher } from "@/components/club-workspace-switcher"
import { DemoMenuItems } from "@/components/demo-controls"
import { NavigationSearch } from "@/components/shell/navigation-search"
import { IconButton } from "@/components/ui/icon-button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getTaskNotifications } from "@/lib/workspace-api"
import { getDurableNotifications } from "@/actions/communications"
import { useApplicationState } from "@/lib/application-state"
import { useOrganizationInvitations } from "@/contexts/organization-invitations-context"
import { createClient } from "@/utils/supabase/client"
import { studentNav, adminNav, type ViewId } from "@/lib/views"
import { canLeaveWorkspace, personalUniversalItems, type ProductNavItem } from "@/lib/product-navigation"
import { hasPermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { handleClubLink } from "@/lib/workspace-navigation"

const navigationIcons: Record<string, typeof Home> = { "student-dashboard": Home, explore: Compass, categories: Compass, status: CheckCircle2, inbox: Bell, "student-profile": UserRound, corkboard: Bookmark, calendar: CalendarDays, applications: FileText, interviews: Video, decisions: CheckCircle2, clubs: Users2, overview: Home, meetings: CalendarDays, tasks: ListChecks, applicants: Users2, members: Users2, announcements: Megaphone, settings: Settings, rounds: Shield, rules: SlidersHorizontal }

export function ProductShell({ children, mode, modes, items, active, title, clubId = "", clubName, manager = false, workspaceKind, onSelect, onNavigate, onReviewTool }: {
  workspaceKind?: "admin";
  onReviewTool?: (id: string) => void;
  children: ReactNode; mode: string; modes: ProductNavItem[]; items: ProductNavItem[]; active: string; title: string;
  clubId?: string; clubName?: string; manager?: boolean; onSelect: (id: string) => void; onNavigate: (view: ViewId) => void;
}) {
  const router = useRouter()
  const { user, isImpersonating } = useAuth(), demo = useDemoMode(), { notifications, syncTaskNotifications, syncDurableNotifications, durableUnread } = useApplicationState()
  const [mobile, setMobile] = useState(false), [search, setSearch] = useState(false), [signingOut, setSigningOut] = useState(false)
  const contextKey = `${clubId}:${mode}:${active}`
  const main = useRef<HTMLElement>(null), previous = useRef(contextKey), moved = useRef(false)
  const mobileOrigin = useRef<HTMLElement | null>(null)
  const searchOrigin = useRef<HTMLElement | null>(null)
  const [taskLoad, setTaskLoad] = useState({ loading: false, failed: false })
  const [durableLoad, setDurableLoad] = useState({ loading: false, failed: false })
  const member = user?.memberships.find(m => m.clubId === clubId)
  const platform = workspaceKind === "admin"
  const personal = !platform && !manager && mode !== "preview"
  const searchItems = manager ? adminNav.filter(item => {
    if (item.id === "leader-dashboard") return hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
    if (item.id === "interview-workspace") return hasPermission(member, "applications.review")
    if (item.id === "interview-scheduler") return hasPermission(member, "interviews.manage") || hasPermission(member, "applications.review")
    if (item.id === "broadcast-messages") return hasPermission(member, "meetings.manage")
    return hasPermission(member, "club.settings")
  }) : [...studentNav.filter(i => i.id !== "student-profile"), { id: "my-clubs" as const, title: "My Clubs", icon: Users2 }]
  const userId = user?.id
  useEffect(() => {
    if (!userId || demo.isDemoEnabled) return
    let active = true, running = false, again = false
    setTaskLoad({ loading: true, failed: false })
    const refresh = async () => {
      if (running) { again = true; return }
      running = true
      try { const items = await getTaskNotifications(); if (active) { syncTaskNotifications(items); setTaskLoad({ loading: false, failed: false }) } }
      catch { if (active) setTaskLoad({ loading: false, failed: true }) }
      finally { running = false; if (again && active) { again = false; void refresh() } }
    }
    refresh()
    const timer=setInterval(refresh,60000)
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
    const stream = !isImpersonating ? new EventSource("/api/communications/stream") : null
    const changed = () => { void refresh(); window.dispatchEvent(new Event("outclass:communications-refresh")) }
    stream?.addEventListener("communications", changed)
    stream?.addEventListener("unavailable", () => { stream.close() })
    const timer = setInterval(changed, 30000)
    window.addEventListener("focus", changed); window.addEventListener("outclass:communications-changed", changed)
    return () => { active = false; clearInterval(timer); stream?.close(); window.removeEventListener("focus", changed); window.removeEventListener("outclass:communications-changed", changed) }
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
    if (personalUniversalItems.some(item => item.id === id)) onNavigate(id as ViewId)
    else onSelect(id)
  }
  function navigate(view: ViewId) { if (canLeaveWorkspace()) onNavigate(view) }
  function navLink(item: ProductNavItem, top = false) {
    const selected = top ? item.id === mode : item.id === active
    const className = top ? "oc-floating-mode-link" : cn("flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring w-full text-left", selected ? "bg-accent font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")
    const NavIcon = navigationIcons[item.id]
    const content = <>{!top && item.id === "student-profile" ? <AccountAvatar user={user} className="size-6" /> : !top && NavIcon && <NavIcon aria-hidden="true" className="size-[18px] shrink-0" />}{item.label}{item.preview && <span className="ml-auto text-[length:var(--oc-size-10)] font-normal text-muted-foreground">Preview</span>}</>
    if (item.quiet && onReviewTool) return <button key={item.id} data-tour={`${top ? "mode" : "nav"}-${item.id}`} type="button" aria-haspopup="dialog" className={className} onClick={() => { if (!canLeaveWorkspace()) return; setMobile(false); onReviewTool(item.id) }}>{content}</button>
    return item.href ? <Link key={item.id} data-tour={`${top ? "mode" : "nav"}-${item.id}`} href={item.href} prefetch={clubId && item.href.split("?")[0] === `/club/${clubId}/workspace` ? false : undefined} aria-current={selected ? "page" : undefined} className={className} onClick={e => { if (!canLeaveWorkspace()) e.preventDefault(); else { moved.current = true; setMobile(false); handleClubLink(e, item.href!) } }}>{content}</Link> : <button key={item.id} data-tour={`${top ? "mode" : "nav"}-${item.id}`} type="button" aria-current={selected ? "page" : undefined} className={className} onClick={() => select(item.id)}>{content}</button>
  }
  function sidebar() { return <div className="oc-context-sidebar flex h-full flex-col overflow-y-auto px-4 py-6">
    <button type="button" className="oc-rail-brand" aria-label="OutClass home" onClick={() => navigate("student-dashboard")}><OutClassLogo variant="dark" /><span>YOUR CAMPUS. CONNECTED.</span></button>
    <div className="mb-7"><ClubWorkspaceSwitcher clubId={manager ? clubId : ""} managersOnly={!platform} adminActive={platform} /></div>
    {!manager && clubId && clubName && <p className="mb-4 break-words px-3 text-sm font-semibold text-primary">{clubName}</p>}
    {personal && <nav aria-label="Universal navigation" className="mb-5 space-y-1">{personalUniversalItems.filter(item => item.id === "student-dashboard").map(item => navLink(item))}</nav>}
    {!platform && <p className="mb-3 px-3 text-[length:var(--oc-size-11)] uppercase tracking-widest text-muted-foreground">{modes.find(m => m.id === mode)?.label || (manager ? "Club" : "Your campus")}</p>}
    {platform ? ["Home", "Platform", "Operations", "System"].map(group => <div key={group} className="mb-5"><p className="mb-2 px-3 text-[length:var(--oc-size-11)] uppercase tracking-widest text-muted-foreground">{group}</p><nav aria-label={group} className="space-y-1">{items.filter(i => (i as ProductNavItem & { group?: string }).group === group).map(i => navLink(i))}</nav></div>) : <nav aria-label="Context navigation" className="space-y-1"><WorkspaceNavigation items={items.filter(i => !i.quiet)} active={active} renderItem={item => navLink(item)} /></nav>}
    {items.some(i => i.quiet) && <div className="mt-8"><p className="mb-3 px-3 text-[length:var(--oc-size-11)] uppercase tracking-widest text-muted-foreground">Review Tools</p><nav aria-label="Review tools" className="space-y-1">{items.filter(i => i.quiet).map(i => navLink(i))}</nav></div>}
    {personal && <nav aria-label="Account navigation" className="mt-6 space-y-1 border-t border-white/10 pt-4">{personalUniversalItems.filter(item => item.id !== "student-dashboard").map(item => navLink(item))}</nav>}
    <div className="oc-rail-footer"><span className="oc-campus-dot" />University of Virginia<span>Student and club workspaces.</span></div>
  </div> }
  return <div className="min-h-dvh bg-background text-foreground" data-product-shell={platform ? "admin" : manager ? "manager" : "personal"} style={{ "--oc-club-accent": member?.club.color || "var(--brand-orange)" } as CSSProperties}>
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-card focus:p-3">Skip to content</a>
    <header className="oc-product-header" data-mode-count={modes.length}>
      <div className="oc-product-header-row">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><IconButton aria-label="Open navigation" className="oc-floating-circle oc-floating-drawer"><Menu /></IconButton></SheetTrigger><SheetContent side="left" className="oc-navigation-sheet w-[min(88vw,300px)] p-0" onCloseAutoFocus={e => { if (moved.current) { e.preventDefault(); main.current?.focus(); moved.current = false; mobileOrigin.current = null } else if (mobileOrigin.current?.isConnected) { e.preventDefault(); mobileOrigin.current.focus(); mobileOrigin.current = null } }}><SheetTitle className="oc-modal-title sr-only">Workspace navigation</SheetTitle><SheetDescription className="sr-only">Choose a workspace or contextual destination.</SheetDescription>{sidebar()}</SheetContent></Sheet>
        {modes.length > 0 && <div className="oc-product-modes"><FloatingModeNavigation aria-label="Product modes" modes={modes} mode={mode}>{modes.map(m => navLink(m, true))}</FloatingModeNavigation></div>}
        <div className="oc-product-utilities">
          <FloatingSearchTrigger open={search} onOpen={trigger => { searchOrigin.current = trigger; setSearch(true) }} />
          <NotificationCenter unread={unread} pendingInvitations={pendingInvitations} loadState={{ loading: !!userId && !demo.isDemoEnabled && (taskLoad.loading || durableLoad.loading), failed: !!userId && !demo.isDemoEnabled && (taskLoad.failed || durableLoad.failed) }} onRetry={() => {
            setTaskLoad({ loading: true, failed: false }); setDurableLoad({ loading: true, failed: false })
            window.dispatchEvent(new Event("outclass:tasks-changed")); window.dispatchEvent(new Event("outclass:communications-changed"))
          }} onNavigate={onNavigate} />
          <DropdownMenu><DropdownMenuTrigger asChild><IconButton data-tour="profile" className="oc-floating-circle oc-floating-profile" aria-label={`Account menu for ${name}`}><AccountAvatar user={user} /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="oc-floating-account-menu w-64"><p className="truncate px-2 py-2 text-sm font-medium">{name}</p><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { if (canLeaveWorkspace()) router.push("/settings/availability") }}><CalendarDays />My Availability</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("student-profile")}><AccountAvatar user={user} className="size-5" />Your profile</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("student-dashboard")}>Personal overview</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("landing")}><Home />OutClass home</DropdownMenuItem>{user && !demo.isDemoEnabled && <DropdownMenuItem onSelect={() => { if (canLeaveWorkspace()) router.push("/settings/organizations") }}><Settings />Organization settings</DropdownMenuItem>}<DemoMenuItems />{user && !demo.isDemoEnabled && !isImpersonating && <DropdownMenuItem disabled={signingOut} onSelect={async () => { if (!canLeaveWorkspace()) return; setSigningOut(true); try { const response = await fetch("/api/auth/logout", { method: "POST" }); if (!response.ok) throw Error("Could not sign out."); const { error } = await createClient().auth.signOut(); if (error) throw error; window.location.assign("/") } catch { toast.error("Could not sign out. Try again."); setSigningOut(false) } }}><LogOut />Sign out</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </div>
    </header>
    <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)]"><aside className="sticky top-28 hidden h-[calc(100dvh-7rem)] border-r border-border lg:block">{sidebar()}</aside><main data-tour="workspace" id="workspace-content" ref={main} tabIndex={-1} aria-label={title} className="oc-workspace-content mx-auto w-full min-w-0 max-w-[1440px] outline-none">
      {demo.isDemoEnabled && <p className="oc-demo-note mb-6 text-xs text-muted-foreground">Fictional demo data · changes stay in this browser; no messages are sent.</p>}{children}
    </main></div>
    <MobileNavigation items={items} active={active} manager={manager || mode === "preview"} onSelect={select} onLink={event => { if (!canLeaveWorkspace()) event.preventDefault() }} onMore={() => { mobileOrigin.current = document.activeElement as HTMLElement; setMobile(true) }} />
    {user && !platform && <TutorialWalkthrough key={`${user.id}:${manager ? "leader" : "student"}`} experience={manager ? "leader" : "student"} clubId={manager ? clubId : undefined} preview={user.impersonating} onOpenStep={step => {
      if (!canLeaveWorkspace()) return
      if ("view" in step) navigate(step.view)
      else router.push(`/club/${encodeURIComponent(clubId)}/workspace?section=${step.section}${step.tool ? `&tool=${step.tool}` : ""}`)
    }} />}
    <NavigationSearch clubId={manager ? clubId : undefined} leader={manager} open={search} onOpenChange={setSearch} onDismissAutoFocus={() => {
      const origin = searchOrigin.current
      if (origin?.isConnected && origin !== document.body) origin.focus({ preventScroll: true })
      else document.querySelector<HTMLButtonElement>(".oc-global-search")?.focus({ preventScroll: true })
    }} items={[...searchItems, { id: "inbox", title: "Notifications", icon: Bell }, { id: "student-profile", title: "Profile", icon: UserRound }]} onNavigate={onNavigate} />
  </div>
}
