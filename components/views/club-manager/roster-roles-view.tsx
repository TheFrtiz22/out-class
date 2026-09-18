"use client"

import { useState } from "react"
import { Lock, UserPlus, MoreHorizontal, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { rosterMembers, type MemberRole, type RosterMember } from "@/lib/data"
import { toast } from "sonner"

const ROLES: MemberRole[] = ["President / Super Admin", "Recruitment Lead / Evaluator", "General Member"]

function roleBadgeVariant(role: MemberRole) {
  if (role === "President / Super Admin") return "default"
  if (role === "Recruitment Lead / Evaluator") return "secondary"
  return "outline"
}

function defaultPermissionsForRole(role: MemberRole) {
  if (role === "President / Super Admin") {
    return { canViewSensitiveData: true, canScoreInterviews: true, canEditQuestions: true }
  }
  if (role === "Recruitment Lead / Evaluator") {
    return { canViewSensitiveData: true, canScoreInterviews: true, canEditQuestions: false }
  }
  return { canViewSensitiveData: false, canScoreInterviews: false, canEditQuestions: false }
}

export function RosterRolesView() {
  const [members, setMembers] = useState<RosterMember[]>(rosterMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<MemberRole>("General Member")

  function updateMember(id: string, patch: Partial<RosterMember>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function handleRoleChange(id: string, role: MemberRole) {
    updateMember(id, { role, ...defaultPermissionsForRole(role) })
  }

  function handleRemove(id: string, name: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    toast.success(`${name} removed from roster`)
  }

  function handleInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email.endsWith("@virginia.edu")) {
      toast.error("Invites must use a @virginia.edu email address")
      return
    }
    const namePart = email.split("@")[0]
    const initials = namePart.slice(0, 2).toUpperCase()
    setMembers((prev) => [
      ...prev,
      {
        id: `rm-${Date.now()}`,
        name: namePart,
        initials,
        email,
        role: inviteRole,
        ...defaultPermissionsForRole(inviteRole),
      },
    ])
    toast.success("Invite sent", { description: `${email} will receive an invite link.` })
    setInviteOpen(false)
    setInviteEmail("")
    setInviteRole("General Member")
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Member Roster & Permissions</CardTitle>
          <CardDescription>
            Control who can see applicant essays, scores, and evaluation data across {members.length} members.
          </CardDescription>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              <UserPlus className="size-4" /> Invite Member via @virginia.edu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a new member</DialogTitle>
              <DialogDescription>Only @virginia.edu email addresses can be invited.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">UVA email</Label>
                <Input
                  id="invite-email"
                  placeholder="abc1de@virginia.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign role</Label>
                <Select value={inviteRole} onValueChange={(v: MemberRole) => setInviteRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite}>Send Invite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member Name</TableHead>
                <TableHead>UVA Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Access Permissions</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isPresident = m.role === "President / Super Admin"
                const isGeneral = m.role === "General Member"
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{m.initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={roleBadgeVariant(m.role)} className="w-fit">
                          {isPresident && <ShieldCheck className="size-3" />}
                          {m.role}
                        </Badge>
                        <Select value={m.role} onValueChange={(v: MemberRole) => handleRoleChange(m.id, v)}>
                          <SelectTrigger className="h-7 w-[210px] text-xs" aria-label="Change role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isGeneral ? (
                        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                          <Lock className="size-3" />
                          No access to applicant CRM or evaluation data
                        </Badge>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs">
                              Manage permissions
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 space-y-4" align="start">
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor={`view-${m.id}`} className="text-sm font-normal leading-snug">
                                Can View Applicant Test Scores & Essays
                              </Label>
                              <Switch
                                id={`view-${m.id}`}
                                checked={m.canViewSensitiveData}
                                disabled={isPresident}
                                onCheckedChange={(v) => updateMember(m.id, { canViewSensitiveData: v })}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor={`score-${m.id}`} className="text-sm font-normal leading-snug">
                                Can Score Candidates in Live Interview Workspace
                              </Label>
                              <Switch
                                id={`score-${m.id}`}
                                checked={m.canScoreInterviews}
                                disabled={isPresident}
                                onCheckedChange={(v) => updateMember(m.id, { canScoreInterviews: v })}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <Label htmlFor={`edit-${m.id}`} className="text-sm font-normal leading-snug">
                                Can Edit Application Questions
                              </Label>
                              <Switch
                                id={`edit-${m.id}`}
                                checked={m.canEditQuestions}
                                disabled={isPresident}
                                onCheckedChange={(v) => updateMember(m.id, { canEditQuestions: v })}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions for {m.name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemove(m.id, m.name)}
                          >
                            Remove from roster
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
