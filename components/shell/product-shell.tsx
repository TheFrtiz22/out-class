"use client"
import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bell, Menu, Search, UserRound, LogOut, Home, Users2 } from "lucide-react"
import { toast } from "sonner"
import { OutClassLogo } from "@/components/outclass-logo"
import { ClubWorkspaceSwitcher } from "@/components/club-workspace-switcher"
import { DemoMenuItems } from "@/components/demo-controls"
import { NavigationSearch } from "@/components/shell/navigation-search"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { useApplicationState } from "@/lib/application-state"
import { createClient } from "@/utils/supabase/client"
import { studentNav, adminNav, type ViewId } from "@/lib/views"
import { canLeaveWorkspace, type ProductNavItem } from "@/lib/product-navigation"
import { hasPermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export function ProductShell({ children, mode, modes, items, active, title, clubId = "", clubName, manager = false, onSelect, onNavigate }: {
  children: ReactNode; mode: string; modes: ProductNavItem[]; items: ProductNavItem[]; active: string; title: string;
  clubId?: string; clubName?: string; manager?: boolean; onSelect: (id: string) => void; onNavigate: (view: ViewId) => void;
}) {
  const { user } = useAuth(), demo = useDemoMode(), { notifications } = useApplicationState()
  const [mobile, setMobile] = useState(false), [search, setSearch] = useState(false), [signingOut, setSigningOut] = useState(false)
  const main = useRef<HTMLElement>(null), previous = useRef(active), moved = useRef(false)
  const member = user?.memberships.find(m => m.clubId === clubId)
  const searchItems = manager ? adminNav.filter(item => {
    if (item.id === "leader-dashboard") return hasPermission(member, "applications.review") || hasPermission(member, "applicants.identify")
    if (item.id === "interview-workspace") return hasPermission(member, "applications.review")
    if (item.id === "interview-scheduler") return hasPermission(member, "interviews.manage") || hasPermission(member, "applications.review")
    if (item.id === "broadcast-messages") return hasPermission(member, "meetings.manage")
    return hasPermission(member, "club.settings")
  }) : [...studentNav.filter(i => i.id !== "student-profile"), { id: "my-clubs" as const, title: "My Clubs", icon: Users2 }]
  const unread = notifications.filter(n => !n.read).length
  const name = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user?.email || "Your account"
  useEffect(() => {
    document.title = `${title} · OutClass`
    if (previous.current !== active) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); previous.current = active }
  }, [active, title])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const close = () => { if (media.matches) setMobile(false) }
    media.addEventListener("change", close)
    return () => media.removeEventListener("change", close)
  }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"][data-state="open"]')) { e.preventDefault(); setSearch(true) }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  function select(id: string) { if (!canLeaveWorkspace()) return; moved.current = true; setMobile(false); onSelect(id) }
  function navigate(view: ViewId) { if (canLeaveWorkspace()) onNavigate(view) }
  function navLink(item: ProductNavItem, top = false) {
    const selected = top ? item.id === mode : item.id === active
    const className = cn("flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", top ? "border-b-2 rounded-b-none whitespace-nowrap sm:px-5" : "w-full text-left", selected ? top ? "border-brand-orange font-semibold text-primary" : "bg-accent font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")
    const content = <>{item.label}{item.preview && <span className="ml-auto text-[10px] font-normal text-muted-foreground">Preview</span>}</>
    return item.href ? <Link key={item.id} href={item.href} aria-current={selected ? "page" : undefined} className={className} onClick={e => { if (!canLeaveWorkspace()) e.preventDefault(); else { moved.current = true; setMobile(false) } }}>{content}</Link> : <button key={item.id} type="button" aria-current={selected ? "page" : undefined} className={className} onClick={() => select(item.id)}>{content}</button>
  }
  function sidebar() { return <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
    <div className="mb-7"><ClubWorkspaceSwitcher clubId={manager ? clubId : ""} managersOnly /></div>
    <p className="mb-3 px-3 text-[11px] uppercase tracking-widest text-muted-foreground">{modes.find(m => m.id === mode)?.label || "Personal"}</p>
    <nav aria-label="Context navigation" className="space-y-1">{items.filter(i => !i.quiet).map(i => navLink(i))}</nav>
    {items.some(i => i.quiet) && <div className="mt-8"><p className="mb-3 px-3 text-[11px] uppercase tracking-widest text-muted-foreground">Review Tools</p><nav aria-label="Review tools" className="space-y-1">{items.filter(i => i.quiet).map(i => navLink(i))}</nav></div>}
    <p className="mt-auto px-3 pt-10 text-xs text-muted-foreground">University of Virginia</p>
  </div> }
  return <div className="min-h-dvh bg-background text-foreground" data-product-shell={manager ? "manager" : "personal"}>
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-card focus:p-3">Skip to content</a>
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <Sheet open={mobile} onOpenChange={setMobile}><SheetTrigger asChild><IconButton aria-label="Open navigation" className="lg:hidden"><Menu /></IconButton></SheetTrigger><SheetContent side="left" className="w-[min(88vw,300px)] p-0" onCloseAutoFocus={e => { if (moved.current) { e.preventDefault(); main.current?.focus(); moved.current = false } }}><SheetTitle className="sr-only">Workspace navigation</SheetTitle><SheetDescription className="sr-only">Choose a workspace or contextual destination.</SheetDescription>{sidebar()}</SheetContent></Sheet>
        <button aria-label="OutClass home" onClick={() => navigate("student-dashboard")} className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-ring"><OutClassLogo variant="light" className="h-8 w-auto" /></button>
        {manager && <div className="hidden min-w-0 border-l pl-4 sm:block"><p className="max-w-72 truncate text-sm font-semibold text-primary">{clubName}</p><p className="text-[11px] text-muted-foreground">Club workspace</p></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" className="hidden text-muted-foreground md:inline-flex" onClick={() => setSearch(true)}><Search />Search <kbd className="ml-2 text-[10px]">⌘ K</kbd></Button>
          <IconButton aria-label="Search OutClass" className="md:hidden" onClick={() => setSearch(true)}><Search /></IconButton>
          <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative" onClick={() => navigate("inbox")}><Bell />{unread > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-orange" />}</IconButton>
          <DropdownMenu><DropdownMenuTrigger asChild><IconButton aria-label={`Account menu for ${name}`}><UserRound /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><p className="truncate px-2 py-2 text-sm font-medium">{name}</p><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate("student-profile")}>Your profile</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("student-dashboard")}>Personal overview</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("landing")}><Home />OutClass home</DropdownMenuItem><DemoMenuItems />{user && !demo.isDemoEnabled && <DropdownMenuItem disabled={signingOut} onSelect={async () => { if (!canLeaveWorkspace()) return; setSigningOut(true); try { const { error } = await createClient().auth.signOut(); if (error) throw error; window.location.assign("/") } catch { toast.error("Could not sign out. Try again."); setSigningOut(false) } }}><LogOut />Sign out</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 lg:pl-[248px]"><nav aria-label="Product modes" className="flex min-w-0 overflow-x-auto">{modes.map(m => navLink(m, true))}</nav>{demo.isDemoEnabled && <span className="shrink-0 text-[10px] text-muted-foreground">Demo Mode</span>}</div>
      {manager && <p className="truncate px-5 pb-2 text-xs text-muted-foreground sm:hidden">{clubName}</p>}
    </header>
    <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)]"><aside className="sticky top-28 hidden h-[calc(100dvh-7rem)] border-r border-border lg:block">{sidebar()}</aside><main id="workspace-content" ref={main} tabIndex={-1} aria-label={title} className="mx-auto w-full min-w-0 max-w-[1440px] px-5 py-7 outline-none sm:px-8 sm:py-10">
      {demo.isDemoEnabled && <p className="mb-6 text-xs text-muted-foreground">Fictional demo data · changes stay in this browser; no messages are sent.</p>}{children}
    </main></div>
    <NavigationSearch clubId={manager ? clubId : undefined} leader={manager} open={search} onOpenChange={setSearch} items={[...searchItems, { id: "inbox", title: "Notifications", icon: Bell }, { id: "student-profile", title: "Profile", icon: UserRound }]} onNavigate={onNavigate} />
  </div>
}
