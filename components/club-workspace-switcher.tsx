"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown } from "@/components/icons"
import { availableSettings } from "@/lib/club-settings"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { ClubLogo } from "@/components/club-logo"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkspaceAccess } from "@/components/shell/use-workspace-access"

/** Club selection is one level below workspace selection. Only managed clubs enter here. */
export function ClubWorkspaceSwitcher({ clubId, access, onSwitch }: { clubId: string; access: WorkspaceAccess; onSwitch?: () => void }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams()
  const current = access.clubs.find(member => member.clubId === clubId)
  if (!current || access.clubs.length < 2) return null
  const identity = <><ClubLogo clubId={clubId} logoUrl={current.club.logoUrl} marketing={current.club.marketing} color={current.club.color || "#142d45"} text={current.club.name.slice(0, 2)} /><span className="oc-header-club-name">{current.club.name}</span></>
  function switchTo(id: string) {
    if (id === clubId || !canLeaveWorkspace()) return
    const next = access.clubs.find(member => member.clubId === id)
    if (!next) return
    const inSettings = params.get("section") === "settings" || pathname.startsWith("/settings") && pathname !== "/settings/interviews"
    const sections = inSettings ? availableSettings(next) : []
    const section = sections.find(section => section.id === params.get("setting")) ?? sections[0]
    router.push(section ? `/club/${encodeURIComponent(id)}/workspace?section=settings&setting=${section.id}` : clubWorkspaceHref(id))
    onSwitch?.()
  }
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="oc-header-club" aria-label={`Switch club: ${current.club.name}`}>{identity}<ChevronsUpDown size={14} aria-hidden="true" /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="oc-header-club-menu w-80 max-w-[calc(100vw-24px)]">
      {access.clubs.map(member => <DropdownMenuItem key={member.id} onSelect={() => switchTo(member.clubId)}>
        <ClubLogo clubId={member.clubId} logoUrl={member.club.logoUrl} marketing={member.club.marketing} color={member.club.color || "#142d45"} text={member.club.name.slice(0, 2)} />
        <span className="min-w-0 flex-1 whitespace-normal">{member.club.name}</span>{member.clubId === clubId && <Check aria-label="Current club" />}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
