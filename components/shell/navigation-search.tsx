"use client"

import { AccountAvatar } from "@/components/account-avatar"
import { useEffect, useRef, useState } from "react"
import { countShellStart } from "@/lib/shell-metrics"
import { ArrowDown, ArrowUp, ArrowUpRight, Building2, FileText, Layers, UserRound } from "@/components/icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { isDemoActive } from "@/lib/demo/loader"
import { useAuth } from "@/contexts/auth-context"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useApplicationState } from "@/lib/application-state"
import { searchWorkspace, type WorkspaceSearchResult } from "@/lib/workspace-api"
import type { NavItem, ViewId } from "@/lib/views"
import { STUDENT_ROUTES, studentPath } from "@/lib/navigation"
import { pluralize } from "@/lib/copy/terms"
import { hasPermission } from "@/lib/permissions"
import { matchDestinations, type SearchDestination } from "@/lib/search-destinations"

const groups = {
  club: "Clubs",
  application: "Your applications",
  applicant: "Applicants",
  round: "Recruitment rounds",
}
const icons = { club: Building2, application: FileText, applicant: UserRound, round: Layers }
export function NavigationSearch({
  open,
  onOpenChange,
  items,
  onNavigate,
  leader = false,
  clubId,
  onDismissAutoFocus,
  links = [],
  destinations = [],
}: {
  /** Every page the account can open in any workspace (lib/search-destinations); matched only once the person types. */
  destinations?: SearchDestination[]
  /** Rail destinations that are not views (club pages, Settings): every nav destination is searchable. */
  links?: { id: string; title: string; href: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  onNavigate: (view: ViewId) => void
  clubId?: string
  /** Opened outside the personal workspace (a club workspace or the platform): applications open by URL. */
  leader?: boolean
  onDismissAutoFocus?: () => void
}) {
  const { user } = useAuth()
  const { focusApplication } = useApplicationState()
  const confirm = useConfirm()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WorkspaceSearchResult[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const selectedDestination = useRef(false)
  // Mounted once by the persistent shell; the counter proves navigation never remounts it.
  useEffect(() => { countShellStart("search") }, [])
  const pages = items.filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const linkPages = links.filter(link => !items.some(item => item.title === link.title) && link.title.toLowerCase().includes(query.trim().toLowerCase()))
  // Pages in other workspaces (other clubs, the personal pages from a club, the platform for admins), one entry per address.
  const local = new Set([...links.map(link => link.href), ...items.flatMap(item => STUDENT_ROUTES.find(route => route.view === item.id)?.path ?? [])])
  const elsewhere = matchDestinations(destinations.filter(page => !local.has(page.href)), query)
  // Applicant names are searchable from anywhere for anyone who can identify applicants in at least one club.
  const findsApplicants = !!user?.memberships.some(member => hasPermission(member, "applicants.identify"))
  useEffect(() => {
    setResults([])
    setError(false)
    if (!open || !user || query.trim().length < 2) {
      setPending(false)
      return
    }
    let active = true
    setPending(true)
    const timer = window.setTimeout(() => {
      searchWorkspace(query)
        .then((items) => {
          if (active) setResults(items)
        })
        .catch(() => {
          if (active) setError(true)
        })
        .finally(() => {
          if (active) setPending(false)
        })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, open, user?.id, retry])
  function close() {
    selectedDestination.current = true
    setQuery("")
    setResults([])
    onOpenChange(false)
  }
  async function prepare() {
    if (document.querySelector('[data-saving="true"]')) return false
    if (
      document.querySelector('[data-unsaved="true"]') &&
      !(await confirm({ title: "Leave this page?", description: "Your unsaved changes will be lost.", confirmLabel: "Leave page", cancelLabel: "Stay", tone: "danger" }))
    )
      return false
    close()
    return true
  }
  async function navigate(view: ViewId) {
    if (await prepare()) onNavigate(view)
  }
  async function choose(item: WorkspaceSearchResult) {
    if (item.kind === "club") {
      if (!(await prepare())) return
      window.location.assign(isDemoActive() ? `/preview?demoClub=${encodeURIComponent(item.clubId)}` : `/club/${encodeURIComponent(item.clubId)}`)
      return
    }
    if (!(await prepare())) return
    // Applicants and rounds open in their own club's workspace, whichever workspace the search was opened from.
    if (item.kind === "applicant" || item.kind === "round") {
      window.location.assign(`/club/${encodeURIComponent(item.clubId)}/workspace?section=recruitment&tool=applicants&${item.kind === "applicant" ? "applicantId" : "roundId"}=${encodeURIComponent(item.id)}`)
      return
    }
    if (item.kind === "application" && clubId) {
      window.location.assign(studentPath("tracker", "applications", { applicationClubId: item.clubId }))
      return
    }
    if (leader) {
      window.location.assign(studentPath("tracker", "applications", { applicationClubId: item.clubId }))
      return
    }
    focusApplication(item.clubId)
    onNavigate("tracker")
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setQuery("")
          setResults([])
        }
        onOpenChange(value)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="oc-navigation-search gap-0 overflow-hidden p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          if (selectedDestination.current) {
            event.preventDefault()
            selectedDestination.current = false
            document.getElementById("workspace-content")?.focus({ preventScroll: true })
          } else if (onDismissAutoFocus) {
            event.preventDefault()
            onDismissAutoFocus()
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search OutClass</DialogTitle>
          <DialogDescription>
            Search pages and authorized records. Use arrow keys to browse, Enter to open, and Escape
            to close.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search OutClass"
            placeholder={
              findsApplicants
                ? "Find a page, applicant, club, or round…"
                : "Find a page, club, or application…"
            }
            value={query}
            onValueChange={setQuery}
            maxLength={120}
          />
          <CommandList className="max-h-[55dvh] p-2">
            {!!(pages.length || linkPages.length) && (
              <CommandGroup heading="Pages">
                {pages.map(({ id, title, icon: Icon }) => (
                  <CommandItem
                    key={id}
                    value={`page-${id}`}
                    onSelect={() => void navigate(id)}
                    className="min-h-11"
                  >
                    {id === "student-profile" ? <AccountAvatar user={user} className="size-5" /> : <Icon className="size-4" />}
                    <span className="flex-1">{title}</span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </CommandItem>
                ))}
                {linkPages.map(link => (
                  <CommandItem key={`link-${link.id}`} value={`link-${link.id}-${link.title}`} onSelect={async () => { if (await prepare()) window.location.assign(link.href) }} className="min-h-11">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                    <span className="flex-1">{link.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!elsewhere.length && (
              <CommandGroup heading="Across OutClass">
                {elsewhere.map(page => (
                  <CommandItem key={`elsewhere-${page.id}`} value={`elsewhere-${page.id}`} onSelect={async () => { if (await prepare()) window.location.assign(page.href) }} className="min-h-12">
                    <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate">{page.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{page.scope}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(Object.keys(groups) as (keyof typeof groups)[]).map((kind) => {
              const matches = results.filter((item) => item.kind === kind)
              return matches.length ? (
                <CommandGroup key={kind} heading={groups[kind]}>
                  {matches.map((item) => {
                    const Icon = icons[kind]
                    return (
                      <CommandItem
                        key={`${kind}-${item.id}`}
                        value={`${kind}-${item.id}`}
                        onSelect={() => void choose(item)}
                        className="min-h-12"
                      >
                        <Icon className="size-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null
            })}
            {!pending && !error && (
              <CommandEmpty>
                {query.trim().length < 2
                  ? "Type at least two letters to search records."
                  : "No matches. Try a club name, applicant surname, or another page."}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
        {pending && (
          <div role="status" className="space-y-2 border-t border-border p-4">
            <span className="sr-only">Searching records…</span>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-t border-border p-4 text-sm"
          >
            <p>Record search couldn’t load. Pages are still available.</p>
            <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
              Retry
            </Button>
          </div>
        )}
        <footer className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {!user
              ? "Sign in to search records"
              : pending
                ? "Searching your workspace"
                : pluralize(pages.length + linkPages.length + elsewhere.length + results.length, "result")}
          </span>
          <span className="inline-flex items-center gap-1"><ArrowUp size={14} aria-hidden="true" /><span className="sr-only">Up arrow</span><ArrowDown size={14} aria-hidden="true" /><span className="sr-only">Down arrow</span> to browse · Enter to open · Esc to close</span>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
