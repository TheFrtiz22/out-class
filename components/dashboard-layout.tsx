"use client"

import type { ReactNode } from "react"
import { OutClassLogo } from "@/components/outclass-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, ShieldCheck } from "lucide-react"
import {
  adminNav,
  studentNav,
  viewTitles,
  type AppMode,
  type ViewId,
} from "@/lib/views"
import { currentStudent } from "@/lib/data"
import { editorialUi } from "@/lib/design-system"
import { cn } from "@/lib/utils"

import { useAuth } from "@/contexts/auth-context"

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
  const { user } = useAuth()
  const hasAdminAccess = user && user.adminRoles.length > 0

  return (
    <div className={cn("dashboard-layout min-h-screen", editorialUi.app)}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-5 px-5 py-4 sm:px-8">
          <button type="button" aria-label="OutClass home" onClick={() => onNavigate("landing")}><OutClassLogo variant="light" className="h-9 w-auto" /></button>
          <nav aria-label={appMode === "admin" ? "Admin navigation" : "Student navigation"} className="order-last flex w-full min-w-0 gap-1 overflow-x-auto lg:order-none lg:w-auto lg:flex-1">
            {navItems.filter((item) => item.id !== "landing").map((item) => <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined} className={cn("shrink-0 rounded-md px-3 py-2 text-sm transition-colors hover:bg-neutral-50", view === item.id ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-500")}>{item.title}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {hasAdminAccess && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between shadow-none font-normal h-9 px-3">
                    <span className="flex items-center gap-2 truncate">
                      {appMode === "admin" ? <><ShieldCheck className="w-4 h-4 text-orange-500" /> Admin View</> : "Student View"}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuItem onClick={() => onModeChange("student")}>
                    Student View
                  </DropdownMenuItem>
                  {user?.adminRoles?.map((role) => (
                    <DropdownMenuItem key={role.clubId} onClick={() => onModeChange("admin")}>
                      Admin View: {role.club.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button type="button" aria-label="Open profile" onClick={() => {
              if (appMode !== "student") onModeChange("student")
              onNavigate("student-profile")
            }} className="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-xs font-semibold">{currentStudent.initials}</button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        {view !== "student-dashboard" && (
          <div className="mb-8">
            <h1 className={cn(editorialUi.title, "text-2xl sm:text-3xl")}>{meta.title}</h1>
            <p className={cn(editorialUi.secondaryText, "mt-2 text-sm leading-relaxed")}>{meta.subtitle}</p>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
