"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check } from "@/components/icons"
import { availableSettings } from "@/lib/club-settings"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { hasPermission } from "@/lib/permissions"
import { ClubLogo } from "@/components/club-logo"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ReactElement } from "react"
import type { WorkspaceAccess } from "@/components/shell/use-workspace-access"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"

/** Club selection is one level below workspace selection. Only managed clubs enter here. The selected club
 *  segment of the workspace pill is the trigger (`children`), so the club name appears once, with the menu on it. */
export function ClubWorkspaceSwitcher({ clubId, access, onSwitch, children }: { clubId: string; access: WorkspaceAccess; onSwitch?: () => void; children: ReactElement }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const current = access.clubs.find(member => member.clubId === clubId)
  if (!current || access.clubs.length < 2) return children
  function switchTo(id: string) {
    if (id === clubId || !canLeaveWorkspace()) return
    const next = access.clubs.find(member => member.clubId === id)
    if (!next) return
    const inSettings = params.get("section") === "settings" || pathname.startsWith("/settings") && pathname !== "/settings/interviews"
    const sections = inSettings ? availableSettings(next) : []
    const section = sections.find(section => section.id === params.get("setting")) ?? sections[0]
    // The application form (formerly a Settings section) stays open across clubs, as Settings sections do.
    const application = params.get("section") === "recruitment" && params.get("tool") === "application" && hasPermission(next, "application.manage")
    router.push(application ? `/club/${encodeURIComponent(id)}/workspace?section=recruitment&tool=application` : section ? `/club/${encodeURIComponent(id)}/workspace?section=settings&setting=${section.id}` : clubWorkspaceHref(id))
    onSwitch?.()
  }
  return <DropdownMenu><DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent align="center" sideOffset={8} collisionPadding={12} className="oc-header-club-menu w-80 max-w-[calc(100vw-24px)]">
      {access.clubs.map(member => <DropdownMenuItem key={member.id} onSelect={() => switchTo(member.clubId)}>
        <ClubLogo clubId={member.clubId} logoUrl={member.club.logoUrl} marketing={member.club.marketing} color={member.club.color || DEFAULT_CLUB_COLOR} text={member.club.name.slice(0, 2)} />
        <span className="min-w-0 flex-1 whitespace-normal">{member.club.name}</span>{member.clubId === clubId && <Check aria-label="Current club" />}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
