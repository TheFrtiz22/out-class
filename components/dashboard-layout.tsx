"use client"
import { hasPermission } from "@/lib/permissions"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bell, ChevronDown, ChevronRight, Home, LogOut, Menu, Search, ShieldCheck, UserRound, Database } from "lucide-react"
import { toast } from "sonner"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { ShellNavigation } from "@/components/shell/navigation"
import { NavigationSearch } from "@/components/shell/navigation-search"
import { adminNav, studentNav, viewTitles, type AppMode, type ViewId, type NavItem } from "@/lib/views"
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"
import { DemoMenuItems } from "@/components/demo-controls"
import { useDemoMode } from "@/contexts/demo-context"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"

export interface DashboardLayoutProps {
  children: ReactNode
  view: ViewId
  appMode: AppMode
  onNavigate: (view: ViewId) => void
  onModeChange: (mode: AppMode, clubId?: string) => void
}

/** Navigation is presentational; existing view IDs and provider ownership stay intact. */
export function DashboardLayout({ children, view, appMode, onNavigate, onModeChange }: DashboardLayoutProps) {
  const { user, loading, activeClubId } = useAuth()
  const { notifications } = useApplicationState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  const drawerNavigated = useRef(false)
  const leader = appMode === "admin"
  const membership = user?.memberships.find(m => m.clubId === activeClubId)
  const items = leader ? adminNav.filter(item => {
    if (item.id === "leader-dashboard") return (hasPermission(membership, "applicants.identify") || hasPermission(membership, "applications.review"))
    if (item.id === "interview-workspace") return (hasPermission(membership, "applicants.identify") || hasPermission(membership, "applications.review")) && hasPermission(membership, "applications.review")
    if (item.id === "interview-scheduler") return hasPermission(membership, "interviews.manage")
    if (item.id === "broadcast-messages") return hasPermission(membership, "meetings.manage")
    return true
  }) : studentNav
  const title = [...studentNav, ...adminNav].find(item => item.id === view)?.title ?? viewTitles[view].title
  const name = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user?.email ?? (loading ? "Loading account…" : "Explore OutClass")
  const initials = user?.profile ? `${user.profile.firstName[0] ?? ""}${user.profile.lastName[0] ?? ""}` : user?.email?.slice(0, 2).toUpperCase() ?? "OC"
  const unread = notifications.filter(item => !item.read).length
  const canSwitch = !!user?.adminRoles.length
  const searchItems: NavItem[] = [...(leader && user && !user.adminRoles.length ? studentNav : items), ...(!items.some(item => item.id === "student-profile") ? [{ id: "student-profile" as const, title: "Profile", icon: UserRound }] : []), { id: "inbox", title: "Notifications", icon: Bell }]

  const { isDemoEnabled } = useDemoMode()

  function navigate(next: ViewId) {
    drawerNavigated.current = mobileOpen
    setMobileOpen(false)
    if ((studentNav.some(item => item.id === next) || next === "inbox") && leader) onModeChange("student")
    onNavigate(next)
  }
  function switchMode(mode: AppMode, clubId?: string) { drawerNavigated.current = mobileOpen; setMobileOpen(false); onModeChange(mode, clubId) }
  useEffect(() => {
    document.title = `${title} · OutClass`
    if (previousView.current === view) return
    previousView.current = view
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [view, title])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const close = () => { if (media.matches) setMobileOpen(false) }
    media.addEventListener("change", close)
    return () => media.removeEventListener("change", close)
  }, [])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      if (document.querySelector('[role="dialog"][data-state="open"]') && !searchOpen) return
      event.preventDefault()
      setSearchOpen(value => !value)
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  }, [searchOpen])
  async function signOut() {
    setSigningOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      window.location.assign("/")
    } catch { toast.error("Could not sign out. Please try again."); setSigningOut(false) }
  }
  function account(compact = false) {
    return <DropdownMenu><DropdownMenuTrigger asChild>
      <button type="button" aria-label={`Account menu for ${name}`} className={cn("flex min-h-11 items-center gap-3 rounded-md text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", compact ? "px-1.5" : "w-full p-2")}>
        <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
        {!compact && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block text-xs text-muted-foreground">{user ? "Your account" : loading ? "Please wait" : "Preview workspace"}</span></span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></>}
      </button>
    </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72">
      <DemoMenuItems />
      <DropdownMenuItem onSelect={() => navigate("student-profile")}><UserRound className="size-4" />Your profile</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => navigate("landing")}><Home className="size-4" />OutClass home</DropdownMenuItem>
      {canSwitch && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => switchMode("student")}><UserRound className="size-4" />{name} — Personal / Student</DropdownMenuItem>{user?.adminRoles.map(member => <DropdownMenuItem key={member.id} onSelect={() => switchMode("admin", member.clubId)}><ShieldCheck className="size-4" />{member.club.name} — Club workspace</DropdownMenuItem>)}</>}
      {!!user?.memberships.length && <><DropdownMenuSeparator />{user.memberships.map(member=><DropdownMenuItem key={`work-${member.id}`} asChild><a href={`/club/${member.clubId}/tasks`}>{member.club.name} — Semester work</a></DropdownMenuItem>)}</>}
      {user && !isDemoEnabled && <><DropdownMenuSeparator /><DropdownMenuItem disabled={signingOut} onSelect={() => { void signOut() }}><LogOut className="size-4" />{signingOut ? "Signing out…" : "Sign out"}</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>
  }
  function sidebar(mobile = false) {
    return <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pb-7 pt-7"><button type="button" aria-label="OutClass home" onClick={() => navigate("landing")} className="rounded-sm"><OutClassLogo variant="light" className="h-10 w-auto" /></button><p className="mt-4 text-xs text-muted-foreground">University of Virginia</p></div>
      <div className="mx-5 border-t border-border" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{leader ? "Club-leader workspace" : "Your workspace"}</p>
        <ShellNavigation items={items} view={view} onNavigate={navigate} label={mobile ? "Mobile workspace navigation" : "Workspace navigation"} />
        {leader && <p className="mt-6 px-3 text-xs leading-relaxed text-muted-foreground">Recruitment, thoughtfully organized.</p>}
      </div>
      <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{account()}</div>
    </div>
  }
  return <div data-workspace={appMode} className="dashboard-layout min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--oc-z-tooltip)] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-white">Skip to content</a>
    <aside className="sticky top-0 hidden h-dvh border-r border-border bg-background lg:block">{sidebar()}</aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-[var(--oc-z-sticky)] flex h-16 items-center gap-2 border-b border-border bg-card px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><IconButton aria-label="Open navigation" className="lg:hidden"><Menu /></IconButton></SheetTrigger><SheetContent side="left" onCloseAutoFocus={event => {
          if (!drawerNavigated.current) return
          event.preventDefault()
          drawerNavigated.current = false
          mainRef.current?.focus({ preventScroll: true })
        }} className="w-[min(88vw,320px)] gap-0 bg-background"><SheetTitle className="sr-only">Workspace navigation</SheetTitle><SheetDescription className="sr-only">Navigate OutClass and manage your account.</SheetDescription>{sidebar(true)}</SheetContent></Sheet>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm"><span className="hidden shrink-0 text-muted-foreground md:inline">{leader ? "Recruitment" : "My workspace"}</span><ChevronRight aria-hidden="true" className="hidden size-3.5 shrink-0 text-muted-foreground md:block" /><span className="truncate font-medium">{title}</span>{isDemoEnabled && <span className="ml-2 shrink-0 rounded border border-border px-2 py-1 text-[10px] text-muted-foreground">Demo Mode</span>}</div>
        <Button variant="ghost" onClick={() => setSearchOpen(true)} className="hidden gap-2 text-muted-foreground sm:inline-flex"><Search aria-hidden="true" />Search <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px]">⌘ / Ctrl K</kbd></Button>
        <IconButton aria-label="Search OutClass" onClick={() => setSearchOpen(true)} className="sm:hidden"><Search /></IconButton>
        <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => navigate("inbox")} className="relative"><Bell />{unread > 0 && <span aria-hidden="true" className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-orange" />}</IconButton>
        <div className="hidden border-l border-border pl-3 sm:block">{account(true)}</div>
      </header>
      <main id="workspace-content" ref={mainRef} tabIndex={-1} aria-label={title} className={cn("mx-auto min-w-0 max-w-[1600px] px-4 py-6 outline-none sm:px-6 lg:px-8", !leader && "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10", leader ? "lg:py-7" : "lg:py-10")}>
        <div key={view} className="shell-content-enter" data-view={view}>
          {view !== "student-dashboard" && <div data-view-heading className="mb-7 max-w-3xl"><h1 className="text-title font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{viewTitles[view].subtitle}</p></div>}
          {["interview-scheduler", "club-management-portal", "screening-dashboard", "broadcast-messages"].includes(view) && <p role="note" className="mb-6 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">Local preview · these tools do not publish club changes, send messages or invitations, or update the live recruitment pipeline.</p>}
          {isDemoEnabled && <p className="mb-5 text-xs leading-relaxed text-muted-foreground">Demo Mode · fictional people and sample club information. Changes stay in this browser; no messages are sent.</p>}
          {children}
        </div>
      </main>
    </div>
    {!leader && <div className="fixed inset-x-0 bottom-0 z-[var(--oc-z-sticky)] border-t border-border bg-card px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"><ShellNavigation items={studentNav} view={view} onNavigate={navigate} label="Primary mobile navigation" mobile /></div>}
    <NavigationSearch leader={leader} key={`${appMode}-${user?.id || "preview"}`} open={searchOpen} onOpenChange={setSearchOpen} items={searchItems} onNavigate={navigate} />
  </div>
}
