"use client"
import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCorkboard } from "@/contexts/corkboard-context"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"
export function CorkboardButton({ club, onNavigate }: { club: DirectoryClub; onNavigate: (view: ViewId) => void }) {
  const { items, authenticated, loading, pending, saveClub, refresh } = useCorkboard()
  const [error, setError] = useState("")
  async function save() {
    setError("")
    try { await saveClub(club, !items.some(item => item.club.id === club.id)) }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save this change.") }
  }
  if (club.source === "preview") return null
  const saved = items.some(item => item.club.id === club.id)
  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" aria-label={`${saved ? "Remove" : "Save"} ${club.name} ${saved ? "from" : "to"} Corkboard`} aria-pressed={saved} disabled={loading || pending.has(club.id)} onClick={() => authenticated ? void save() : onNavigate("auth")}>
      {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}{authenticated ? saved ? "Remove from Corkboard" : "Save to Corkboard" : "Sign in to save"}
    </Button>
    {error && <p role="status" className="text-xs text-destructive">{error}<button className="ml-2 underline" onClick={() => void refresh()}>Retry</button></p>}
  </div>
}
