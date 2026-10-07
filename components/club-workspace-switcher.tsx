"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, UserRound, Shield } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { hasWorkspace } from "@/lib/permissions"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import { ClubLogo } from "@/components/club-logo"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function ClubWorkspaceSwitcher({ clubId = "", managersOnly = false, adminActive = false }: { clubId?: string; managersOnly?: boolean; adminActive?: boolean }) {
  const { user } = useAuth()
  const router = useRouter()
  const [eligible, setEligible] = useState(false)
  const { isImpersonating } = useAuth()
  const identityId = user?.id, impersonating = user?.impersonating
  useEffect(() => {
    let live = true
    setEligible(false)
    if (identityId && !impersonating) void fetch("/api/platform/eligibility", { cache: "no-store" }).then(r => r.json()).then(r => { if (live) setEligible(r.eligible === true) }).catch(() => {})
    return () => { live = false }
  }, [identityId, impersonating])
  if (!user) return null
  const memberships = user.memberships.filter(member => !managersOnly || hasWorkspace(member))
  const current = memberships.find(member => member.clubId === clubId)
  function switchTo(id: string) {
    if (canLeaveWorkspace()) router.push(id ? clubWorkspaceHref(id) : "/?workspace=student")
  }
  return <div className="oc-workspace-switcher">
    <p className="oc-workspace-switcher-label">Workspace</p>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" aria-label="Switch workspace" className="oc-workspace-switcher-trigger">
        {adminActive ? <span className="oc-workspace-personal-icon"><Shield size={18} /></span> : current ? <ClubLogo clubId={clubId} logoUrl={current.club.logoUrl} color={current.club.color || "#142d45"} text={current.club.name.slice(0,2)} /> : <span className="oc-workspace-personal-icon"><UserRound size={18} /></span>}
        <span><strong>{adminActive ? "Admin" : current?.club.name || "Personal"}</strong><small>{adminActive ? "Platform administration" : current ? "Club workspace" : user.profile?.firstName || "Your campus"}</small></span><ChevronsUpDown size={14} aria-hidden="true" />
      </button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="oc-workspace-menu w-72">
        <DropdownMenuItem onSelect={() => switchTo("")}><UserRound /><span className="flex-1">Personal workspace</span>{!clubId && !adminActive && <Check />}</DropdownMenuItem>
        {memberships.length > 0 && <DropdownMenuSeparator />}
        {memberships.map(member => <DropdownMenuItem key={member.id} onSelect={() => switchTo(member.clubId)}>
          <ClubLogo clubId={member.clubId} logoUrl={member.club.logoUrl} color={member.club.color || "#142d45"} text={member.club.name.slice(0,2)} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{member.club.name}</strong><small className="text-xs text-muted-foreground">{hasWorkspace(member) ? "Leader workspace" : "Member workspace"}</small></span>{member.clubId === clubId && <Check />}
        </DropdownMenuItem>)}
        {eligible && !isImpersonating && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { if (canLeaveWorkspace()) router.push("/platform") }}><Shield /><span className="flex-1">Admin</span>{adminActive && <Check />}</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
}
