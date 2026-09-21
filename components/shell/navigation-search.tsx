"use client"

import { useRef, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Search } from "@/components/ui/search"
import type { NavItem, ViewId } from "@/lib/views"

/** Search only available destinations, not disconnected or private records. */
export function NavigationSearch({ open, onOpenChange, items, onNavigate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NavItem[]
  onNavigate: (view: ViewId) => void
}) {
  const [query, setQuery] = useState("")
  const selectedDestination = useRef(false)
  const results = items.filter(item => item.title.toLowerCase().includes(query.trim().toLowerCase()))
  function navigate(view: ViewId) { selectedDestination.current = true; setQuery(""); onOpenChange(false); onNavigate(view) }
  return <Dialog open={open} onOpenChange={value => { if (!value) setQuery(""); onOpenChange(value) }}>
    <DialogContent className="gap-5 sm:max-w-lg" onCloseAutoFocus={event => {
      if (!selectedDestination.current) return
      event.preventDefault()
      selectedDestination.current = false
      document.getElementById("workspace-content")?.focus({ preventScroll: true })
    }}>
      <DialogHeader><DialogTitle>Find a page</DialogTitle><DialogDescription>Go straight to a page in your workspace.</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); if (results[0]) navigate(results[0].id) }}>
        <Search autoFocus aria-label="Search workspace pages" placeholder="Search pages…" value={query} onChange={event => setQuery(event.target.value)} />
      </form>
      <p className="sr-only" role="status">{results.length} matching pages</p>
      <ul className="max-h-[45dvh] space-y-1 overflow-y-auto">
        {results.map(({ id, title, icon: Icon }) => <li key={id}><button type="button" onClick={() => navigate(id)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><Icon aria-hidden="true" className="size-4 text-muted-foreground" /><span className="flex-1">{title}</span><ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" /></button></li>)}
        {!results.length && <li className="px-3 py-6 text-sm text-muted-foreground">No pages found. Try another name.</li>}
      </ul>
    </DialogContent>
  </Dialog>
}
