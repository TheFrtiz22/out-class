"use client"
import { LoadingState } from "@/components/ui/loading-state"
import Link from "next/link"
import "./club-discovery.css"
import { useState } from "react"
import { Bookmark, ArrowUpRight, X } from "@/components/icons"
import { useCorkboard } from "@/contexts/corkboard-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import type { ViewId } from "@/lib/views"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** All saved-club controls share CorkboardProvider's optimistic state and existing actions. */
export function SavedClubsPopover({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { items, loading, authenticated, error, pending, refresh, saveClub } = useCorkboard()
  const [open, setOpen] = useState(false)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" className="min-h-11 gap-2"><Bookmark className="size-4" aria-hidden="true" />Saved Clubs</Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Saved Clubs" className="w-[min(24rem,calc(100vw-2rem))] p-0">
      <header className="flex items-start justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Saved Clubs</h2><p className="mt-1 text-xs text-muted-foreground">{items.length ? `${items.length} saved ${items.length === 1 ? "club" : "clubs"}` : "Clubs to come back to."}</p></div><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Close saved clubs" onClick={() => setOpen(false)}><X className="size-4" /></Button></header>
      <div className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2">
        {loading ? <LoadingState label="Loading saved clubs…" layout="feed" rows={2} className="p-4" /> : !authenticated ? <div className="space-y-3 p-4 text-sm"><p>Sign in to save clubs and see them here.</p>{onNavigate && <Button onClick={() => { setOpen(false); onNavigate("auth") }}>Sign in</Button>}</div> : <>
          {error && <div role="alert" className="space-y-2 p-3 text-sm"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>Retry saved clubs</Button></div>}
          {items.length ? <ul className="space-y-1">{items.map(({ club }) => <li key={club.id} className="flex items-center gap-1 rounded-lg hover:bg-muted/50">
            <Link href={`/club/${encodeURIComponent(club.id)}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-ring" onClick={event => { if (!canLeaveWorkspace()) event.preventDefault(); else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) setOpen(false) }}>
              <DirectoryLogo club={club} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{club.name}</strong><span className="block truncate text-xs text-muted-foreground">{club.category}</span></span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </Link><Button type="button" variant="ghost" size="icon" className="mr-1 size-11 shrink-0" aria-label={`Remove ${club.name} from saved clubs`} disabled={pending.has(club.id)} onClick={event => {
              // Keep keyboard focus in the popover when the optimistic row disappears.
              const row = event.currentTarget.closest("li")
              const next = row?.nextElementSibling ?? row?.previousElementSibling
              const focus = next?.querySelector<HTMLElement>("a") ?? event.currentTarget.closest('[data-slot="popover-content"]')?.querySelector<HTMLElement>('[aria-label="Close saved clubs"]')
              focus?.focus()
              void saveClub(club, false).catch(() => {})
            }}><X className="size-4" /></Button>
          </li>)}</ul> : !error && <div className="space-y-2 p-4 text-sm"><p className="font-medium">No saved clubs yet.</p><p className="leading-relaxed text-muted-foreground">Save a club from Explore or its profile, and it will appear here.</p></div>}
        </>}
      </div>
    </PopoverContent>
  </Popover>
}
