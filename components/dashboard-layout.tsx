"use client"
import { useEffect, type ReactNode } from "react"
import { PageHeader } from "@/components/product/page-header"
import { ProductShell } from "@/components/shell/product-shell"
import { personalMode, personalItems, personalModes, type PersonalSection } from "@/lib/product-navigation"
import { adminNav, viewTitles, type AppMode, type ViewId } from "@/lib/views"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { useApplicationState } from "@/lib/application-state"
import { hasWorkspace } from "@/lib/permissions"
export interface DashboardLayoutProps {
  children: ReactNode; view: ViewId; appMode: AppMode; onNavigate: (view: ViewId, section?: PersonalSection) => void;
  onModeChange: (mode: AppMode, clubId?: string) => void;
  personalSection?: PersonalSection; onPersonalSection?: (section: PersonalSection) => void;
}
export function DashboardLayout({ children, view, appMode, onNavigate, personalSection = "explore", onPersonalSection }: DashboardLayoutProps) {
  const { user, activeClubId } = useAuth()
  const router = useRouter()
  const { leaderFocus, focusApplication } = useApplicationState()
  const applicationClubId = useSearchParams().get("applicationClubId")
  useEffect(() => { if (applicationClubId) focusApplication(applicationClubId) }, [applicationClubId, focusApplication])
  const leaderView = ["leader-dashboard", "interview-scheduler", "club-manager", "broadcast-messages", "screening-dashboard", "club-management-portal"].includes(view)
  const managed = user?.memberships.find(m => m.clubId === (leaderFocus?.clubId || activeClubId) && hasWorkspace(m))
  const managedClubId = managed?.clubId
  useEffect(() => {
    if (!leaderView || !managedClubId) return
    const section = view === "club-manager" || view === "club-management-portal" ? "settings" : view === "broadcast-messages" ? "announcements" : "recruitment"
    const query = new URLSearchParams({ section })
    if (section === "recruitment") query.set("tool", view === "interview-scheduler" ? "interviews" : view === "screening-dashboard" ? "rules" : "applicants")
    if (leaderFocus?.applicantId) query.set("applicantId", leaderFocus.applicantId)
    if (leaderFocus?.roundId) query.set("roundId", leaderFocus.roundId)
    router.replace(`/club/${encodeURIComponent(managedClubId)}/workspace?${query}`)
  }, [leaderView, managedClubId, view, leaderFocus, router])
  const section = view === "calendar" ? "calendar" : view === "tracker" ? (["applications", "interviews", "decisions"].includes(personalSection) ? personalSection : "applications") : view === "my-clubs" ? personalSection : view === "explore" ? "explore" : view === "corkboard" ? "corkboard" : personalSection
  const mode = personalMode(section)
  const items = personalItems(!!user?.memberships.length)
  function select(id: string) {
    if (id === "student-dashboard") { onNavigate("student-dashboard"); return }
    const next = id
    const target = ["applications", "interviews", "decisions"].includes(next) ? "tracker" : ["clubs", "meetings", "tasks"].includes(next) ? "my-clubs" : next === "calendar" ? "calendar" : next === "corkboard" ? "corkboard" : "explore"
    onNavigate(target, next as PersonalSection)
    onPersonalSection?.(next as PersonalSection)
  }
  if (leaderView && managed) return <p role="status" className="p-8">Opening club workspace…</p>
  if (!user && appMode === "admin") return <ProductShell mode="preview" modes={[{ id: "preview", label: "Local workspace preview" }]} items={adminNav.map(i => ({ id: i.id, label: i.title, preview: true }))} active={view} title={viewTitles[view].title} onSelect={id => { if (id !== "preview") onNavigate(id as ViewId) }} onNavigate={onNavigate}><p className="mb-6 text-sm text-muted-foreground">Local preview · sample data only. These controls do not publish changes.</p>{children}</ProductShell>
  const title = view === "my-clubs" && section === "clubs" ? "My Clubs" : items.find(i => i.id === section)?.label || viewTitles[view].title
  return <ProductShell mode={mode} modes={personalModes} items={items} active={view === "student-profile" || view === "inbox" || view === "student-dashboard" ? view : section} title={viewTitles[view].title} onSelect={select} onNavigate={onNavigate}>
    {view !== "student-dashboard" && view !== "explore" && view !== "tracker" && view !== "corkboard" && <PageHeader eyebrow="Your campus, connected" title={["student-profile", "inbox"].includes(view) ? viewTitles[view].title : title} ribbon />}
    {(["interview-scheduler", "club-management-portal", "screening-dashboard", "broadcast-messages"].includes(view) || appMode === "admin") && <p className="mb-6 border-l-2 pl-4 text-sm text-muted-foreground">Existing workspace tools · preview controls do not publish changes or send messages.</p>}
    {children}
  </ProductShell>
}
