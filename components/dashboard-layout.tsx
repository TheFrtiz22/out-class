"use client"
import { useEffect, type ReactNode } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { ProductShell } from "@/components/shell/product-shell"
import { personalMode, personalItems, personalDestination, type PersonalSection } from "@/lib/product-navigation"
import { viewTitles, type AppMode, type ViewId } from "@/lib/views"
import { useAuth } from "@/contexts/auth-context"
import { InboxNotificationSettings } from "@/components/inbox/inbox-notification-settings"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useApplicationState } from "@/lib/application-state"
import { hasWorkspace } from "@/lib/permissions"
import { AuthSessionBoundary } from "@/components/auth-session-boundary"
import { inPlaceSections, isLeaderWorkspaceView, leaderWorkspaceHref, personalRailSections } from "@/lib/navigation"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useInWorkspaceShell, useShellBindings } from "@/components/shell/workspace-shell-context"
export interface DashboardLayoutProps {
  children: ReactNode; view: ViewId; appMode: AppMode; onNavigate: (view: ViewId, section?: PersonalSection) => void;
  onModeChange: (mode: AppMode, clubId?: string) => void;
  personalSection?: PersonalSection; onPersonalSection?: (section: PersonalSection) => void;
}
export function DashboardLayout(props: DashboardLayoutProps) {
  return <AuthSessionBoundary><DashboardContent {...props} /></AuthSessionBoundary>
}
function DashboardContent({ children, view, appMode, onNavigate, personalSection = "explore", onPersonalSection }: DashboardLayoutProps) {
  const { user, activeClubId } = useAuth()
  const router = useRouter()
  // The sample-data preview must never link out to the live student routes.
  const preview = usePathname()?.startsWith("/preview") ?? false
  const { leaderFocus, focusApplication } = useApplicationState()
  const applicationClubId = useSearchParams().get("applicationClubId")
  useEffect(() => { if (applicationClubId) focusApplication(applicationClubId) }, [applicationClubId, focusApplication])
  const leaderView = isLeaderWorkspaceView(view)
  const managed = user?.memberships.find(m => m.clubId === (leaderFocus?.clubId || activeClubId) && hasWorkspace(m))
  const managedClubId = managed?.clubId
  useEffect(() => {
    if (!isLeaderWorkspaceView(view) || !managedClubId) return
    router.replace(leaderWorkspaceHref(view, managedClubId, { applicantId: leaderFocus?.applicantId, roundId: leaderFocus?.roundId }))
  }, [managedClubId, view, leaderFocus, router])
  const section = view === "status" ? "status" : view === "tracker" ? "applications" : view === "corkboard" ? "corkboard" : view === "explore" ? personalSection === "categories" ? "categories" : "explore" : personalSection
  const mode = personalMode(section)
  const items = personalItems(mode)
  function select(id: string) {
    const destination = personalDestination(id)
    onNavigate(destination.view, destination.section)
    if (destination.section) onPersonalSection?.(destination.section)
  }
  const inShell = useInWorkspaceShell()
  const universalView = ["student-dashboard", "calendar", "student-profile", "inbox"].includes(view)
  const title = universalView ? viewTitles[view].title : view === "my-clubs" && section === "clubs" ? "My Clubs" : items.find(i => i.id === section)?.label || viewTitles[view].title
  // Inside app/(workspace) the shell is already on screen: hand it this page's title and in-place navigation.
  useShellBindings({ title, active: universalView ? view : section, onSelect: select, onNavigate }, inShell)
  if (leaderView && managed) return inShell ? <WorkspaceLoading label="Opening club workspace…" /> : <OutClassLoadingScreen />
  const content = <>
    {view !== "student-dashboard" && view !== "explore" && view !== "tracker" && view !== "status" && view !== "corkboard" && <PageHeader title={["student-profile", "inbox"].includes(view) ? viewTitles[view].title : title} description={view === "inbox" ? "Announcements, application updates and tasks from your clubs." : undefined} className={view === "inbox" ? "oc-notifications-header" : undefined} action={view === "inbox" ? <InboxNotificationSettings /> : undefined} />}
    {(["interview-scheduler", "screening-dashboard", "broadcast-messages"].includes(view) || appMode === "admin") && <p className="mb-6 border-l-2 pl-4 text-sm text-muted-foreground">Existing workspace tools · preview controls do not publish changes or send messages.</p>}
    {children}
  </>
  if (inShell) return content
  return <ProductShell mode={mode} sections={preview ? inPlaceSections(personalRailSections()) : personalRailSections()} active={universalView ? view : section} title={title} onSelect={select} onNavigate={onNavigate}>
    {content}
  </ProductShell>
}
