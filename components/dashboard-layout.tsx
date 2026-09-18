"use client"

import type { ReactNode } from "react"
import { GraduationCap, ShieldCheck } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  adminClubName,
  adminNav,
  studentNav,
  viewTitles,
  type AppMode,
  type ViewId,
} from "@/lib/views"
import { currentStudent } from "@/lib/data"
import { editorialUi } from "@/lib/design-system"
import { cn } from "@/lib/utils"

export interface DashboardLayoutProps {
  children: ReactNode
  view: ViewId
  appMode: AppMode
  onNavigate: (view: ViewId) => void
  onModeChange: (mode: AppMode) => void
}

/** Shared editorial shell; view state and application data remain in AppShell. */
export function DashboardLayout({ children, view, appMode, onNavigate, onModeChange }: DashboardLayoutProps) {
  const meta = viewTitles[view]
  const navItems = appMode === "admin" ? adminNav : studentNav
  return (
      <SidebarProvider className={cn("dashboard-layout", editorialUi.app)}>
        <Sidebar className={editorialUi.sidebar}>
          <SidebarHeader>
            <button type="button" aria-label="OutClass home" className="flex items-center gap-2 px-2 py-4" onClick={() => onNavigate("landing")}>
              <OutClassLogo variant="mark" className="group-data-[collapsible=icon]:block hidden" />
              <OutClassLogo
                variant="light"
                className="h-10 w-auto group-data-[collapsible=icon]:hidden"
              />
            </button>

            <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
              <Select value={appMode} onValueChange={(value) => onModeChange(value as AppMode)}>
                <SelectTrigger
                  aria-label="Switch application view"
                  className="w-full border-border bg-white text-foreground shadow-none [&>svg]:text-muted-foreground"
                >
                  {appMode === "admin" ? (
                    <ShieldCheck className="size-4 text-muted-foreground" />
                  ) : (
                    <GraduationCap className="size-4 text-muted-foreground" />
                  )}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student View</SelectItem>
                  <SelectItem value="admin">{`Admin View: ${adminClubName}`}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{appMode === "admin" ? "Executive" : "Student"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={view === item.id}
                        onClick={() => onNavigate(item.id)}
                        tooltip={item.title}
                        aria-current={view === item.id ? "page" : undefined}
                        className={cn(
                          "h-11 rounded-r-lg rounded-l-none px-3",
                          editorialUi.sidebarLink,
                          "data-[active=true]:border-neutral-900 data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-neutral-900",
                        )}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
                  {currentStudent.initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium text-foreground">
                  {currentStudent.name}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{currentStudent.email}</span>
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="flex min-h-24 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-5 py-5 sm:px-8">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="min-w-0 flex-1">
              <h1 className={cn(editorialUi.title, "text-2xl sm:text-3xl")}>{meta.title}</h1>
              <p className={cn(editorialUi.secondaryText, "text-xs leading-relaxed")}>{meta.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted lg:inline-flex"
                onClick={() => onNavigate("landing")}
              >
                Back to Landing Page
              </button>
              <Badge
                variant="outline"
                className="hidden gap-1.5 font-normal text-muted-foreground sm:inline-flex"
              >
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {appMode === "admin" ? "Admin" : "Student"} view
              </Badge>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] flex-1 bg-white p-5 sm:p-8 lg:p-10">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
  )
}
