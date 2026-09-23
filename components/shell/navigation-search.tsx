"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, Building2, FileText, Layers, UserRound } from "lucide-react"
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
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"
import { searchWorkspace, type WorkspaceSearchResult } from "@/actions/workspace-search"
import type { NavItem, ViewId } from "@/lib/views"

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  onNavigate: (view: ViewId) => void
  leader?: boolean
}) {
  const { user } = useAuth()
  const { focusApplication, focusLeader } = useApplicationState()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WorkspaceSearchResult[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const selectedDestination = useRef(false)
  const pages = items.filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
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
      searchWorkspace(query, leader)
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
  }, [query, open, user?.id, leader, retry])
  function close() {
    selectedDestination.current = true
    setQuery("")
    setResults([])
    onOpenChange(false)
  }
  function prepare() {
    if (document.querySelector('[data-saving="true"]')) return false
    if (
      document.querySelector('[data-unsaved="true"]') &&
      !window.confirm("Leave this page? Your unsaved changes will be lost.")
    )
      return false
    close()
    return true
  }
  function navigate(view: ViewId) {
    if (prepare()) onNavigate(view)
  }
  function choose(item: WorkspaceSearchResult) {
    if (item.kind === "club") {
      if (document.querySelector('[data-saving="true"]')) return
      window.location.assign(`/club/${encodeURIComponent(item.clubId)}`)
      return
    }
    if (!prepare()) return
    if (item.kind === "application") {
      focusApplication(item.clubId)
      onNavigate("tracker")
    } else {
      focusLeader({
        clubId: item.clubId,
        ...(item.kind === "applicant" ? { applicantId: item.id } : { roundId: item.id }),
      })
      onNavigate("leader-dashboard")
    }
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
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          if (selectedDestination.current) {
            event.preventDefault()
            selectedDestination.current = false
            document.getElementById("workspace-content")?.focus({ preventScroll: true })
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
            autoFocus
            aria-label="Search OutClass"
            placeholder={
              leader
                ? "Find a page, applicant, club, or round…"
                : "Find a page, club, or application…"
            }
            value={query}
            onValueChange={setQuery}
            maxLength={120}
          />
          <CommandList className="max-h-[55dvh] p-2">
            {!!pages.length && (
              <CommandGroup heading="Pages">
                {pages.map(({ id, title, icon: Icon }) => (
                  <CommandItem
                    key={id}
                    value={`page-${id}`}
                    onSelect={() => navigate(id)}
                    className="min-h-11"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{title}</span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
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
                        onSelect={() => choose(item)}
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
                : `${pages.length + results.length} results`}
          </span>
          <span>↑ ↓ to browse · Enter to open · Esc to close</span>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
