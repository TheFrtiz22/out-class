"use client"

import { useRef, useState, type DragEvent } from "react"
import { toast } from "sonner"
import {
  FileText,
  UserCog,
  Users,
  ImageIcon,
  Upload,
  X,
  Pencil,
  Trash2,
  Check,
  UserPlus,
  Search,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  clubExecutives,
  initialClubPublicPageDetails,
  rosterMembers,
  type ClubExecutive,
  type ClubPublicPageDetails,
} from "@/lib/data"

const NAVY = "#051B3D"
const ORANGE = "#FF5900"

type PortalTab = "public" | "roster" | "directory"

const TABS: { id: PortalTab; label: string; icon: typeof FileText }[] = [
  { id: "public", label: "Public Page Details", icon: FileText },
  { id: "roster", label: "Executive Roster", icon: UserCog },
  { id: "directory", label: "Member Directory", icon: Users },
]

export function ClubManagementPortalView() {
  const [activeTab, setActiveTab] = useState<PortalTab>("public")

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex-row">
      <aside className="shrink-0 border-b border-gray-200 bg-white p-3 lg:w-64 lg:border-b-0 lg:border-r">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors",
                  isActive ? "text-white" : "text-gray-600 hover:bg-gray-100",
                )}
                style={isActive ? { backgroundColor: NAVY } : undefined}
              >
                <tab.icon className="size-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 bg-white">
        {activeTab === "public" && <PublicPageDetailsPanel />}
        {activeTab === "roster" && <ExecutiveRosterPanel />}
        {activeTab === "directory" && <MemberDirectoryPanel />}
      </main>
    </div>
  )
}

function PublicPageDetailsPanel() {
  const [details, setDetails] = useState<ClubPublicPageDetails>(initialClubPublicPageDetails)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof ClubPublicPageDetails>(key: K, value: ClubPublicPageDetails[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }))
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    set("logoUrl", URL.createObjectURL(file))
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleSave() {
    toast.success("Public page updated", { description: "Your changes are now live on your club's profile." })
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: NAVY }}>
            Public Page Details
          </h2>
          <p className="text-sm text-gray-500">
            Edit the information prospective applicants see on your club's public profile.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-name" style={{ color: NAVY }}>
            Club Logo
          </Label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-400 transition-colors hover:border-gray-400",
                isDragging && "border-solid bg-orange-50",
              )}
              style={isDragging ? { borderColor: ORANGE, color: ORANGE } : undefined}
              aria-label="Upload club logo"
            >
              {details.logoUrl ? (
                <img
                  src={details.logoUrl || "/placeholder.svg"}
                  alt="Club logo preview"
                  className="size-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <span className="flex flex-col items-center gap-1 px-2 text-center">
                  <ImageIcon className="size-6" />
                  <span className="text-[11px] font-medium leading-tight">Drop or click to upload</span>
                </span>
              )}
              {details.logoUrl && (
                <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
                  <Upload className="size-5" />
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs text-gray-500">Square image recommended, at least 200×200px.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="size-3.5" /> {details.logoUrl ? "Replace" : "Upload"}
                </button>
                {details.logoUrl && (
                  <button
                    type="button"
                    onClick={() => set("logoUrl", null)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600"
                  >
                    <X className="size-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="club-name" style={{ color: NAVY }}>
              Club Name
            </Label>
            <Input
              id="club-name"
              value={details.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Virginia Venture Fund"
              className="border-gray-200 bg-white text-gray-900"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline" style={{ color: NAVY }}>
              Tagline
            </Label>
            <Input
              id="tagline"
              value={details.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="UVA's student-run venture capital fund"
              className="border-gray-200 bg-white text-gray-900"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="about-us" style={{ color: NAVY }}>
            About Us
          </Label>
          <Textarea
            id="about-us"
            value={details.aboutUs}
            onChange={(e) => set("aboutUs", e.target.value)}
            rows={8}
            placeholder="Tell applicants what your club does and what makes it distinctive."
            className="resize-none border-gray-200 bg-white text-gray-900"
          />
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
        <Button onClick={handleSave} className="text-white hover:opacity-90" style={{ backgroundColor: ORANGE }}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}

function ExecutiveRosterPanel() {
  const [executives, setExecutives] = useState<ClubExecutive[]>(clubExecutives)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")

  function startEdit(exec: ClubExecutive) {
    setEditingId(exec.id)
    setEditingTitle(exec.title)
  }

  function saveEdit() {
    if (!editingId) return
    setExecutives((prev) =>
      prev.map((e) => (e.id === editingId ? { ...e, title: editingTitle.trim() || e.title } : e)),
    )
    setEditingId(null)
  }

  function removeExec(id: string, name: string) {
    setExecutives((prev) => prev.filter((e) => e.id !== id))
    toast.success(`${name} removed from the executive roster`)
  }

  function handleInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email.endsWith("@virginia.edu")) {
      toast.error("Invites must use a @virginia.edu email address")
      return
    }
    toast.success("Invite sent", { description: `${email} will receive an executive invite link.` })
    setInviteOpen(false)
    setInviteEmail("")
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: NAVY }}>
            Executive Roster
          </h2>
          <p className="text-sm text-gray-500">Manage your club's executive team and their titles.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInviteOpen(true)}
          className="shrink-0 border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <UserPlus className="size-4" /> Invite New Executive
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
        {executives.map((exec, i) => {
          const isEditing = editingId === exec.id
          return (
            <div
              key={exec.id}
              className={cn(
                "flex items-center gap-3 bg-white px-4 py-3",
                i !== executives.length - 1 && "border-b border-gray-200",
              )}
            >
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: `${NAVY}1A`, color: NAVY }}>
                  {exec.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{exec.name}</p>
                {isEditing ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="h-7 max-w-64 border-gray-200 bg-white text-xs text-gray-900"
                    />
                    <Button
                      size="icon"
                      className="size-7 shrink-0 text-white hover:opacity-90"
                      style={{ backgroundColor: ORANGE }}
                      onClick={saveEdit}
                      aria-label="Save title"
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-gray-500 hover:bg-gray-100"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel edit"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="truncate text-xs text-gray-500">{exec.title}</p>
                )}
              </div>
              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    onClick={() => startEdit(exec)}
                    aria-label={`Edit title for ${exec.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeExec(exec.id, exec.name)}
                    aria-label={`Remove admin access for ${exec.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
        {executives.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No executives on the roster.</p>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle style={{ color: NAVY }}>Invite a new executive</DialogTitle>
            <DialogDescription className="text-gray-500">
              Send an admin invite to a student. Only @virginia.edu email addresses can be invited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="exec-invite-email" style={{ color: NAVY }}>
              Student email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="exec-invite-email"
                placeholder="abc1de@virginia.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="border-gray-200 bg-white pl-9 text-gray-900"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} className="text-white hover:opacity-90" style={{ backgroundColor: ORANGE }}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MemberDirectoryPanel() {
  const [query, setQuery] = useState("")
  const filtered = rosterMembers.filter(
    (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="p-6">
      <div>
        <h2 className="text-base font-semibold" style={{ color: NAVY }}>
          Member Directory
        </h2>
        <p className="text-sm text-gray-500">Browse every member currently on your club's roster.</p>
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name or email…"
          className="border-gray-200 bg-white pl-9 text-gray-900"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        {filtered.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center gap-3 bg-white px-4 py-3",
              i !== filtered.length - 1 && "border-b border-gray-200",
            )}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: `${NAVY}1A`, color: NAVY }}>
                {m.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
              <p className="truncate text-xs text-gray-500">{m.email}</p>
            </div>
            <span
              className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600"
            >
              {m.role}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No members match your search.</p>
        )}
      </div>
    </div>
  )
}
