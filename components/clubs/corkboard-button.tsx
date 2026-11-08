"use client"
import { useState } from "react"
import { Bookmark, BookmarkCheck } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useCorkboard } from "@/contexts/corkboard-context"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"

/**
 * Saves a club to the signed-in account (Saved clubs). `mode="follow"` is the same account
 * record presented as Follow on public club pages; there are no email updates behind it.
 * Signed out, either mode asks the visitor to sign in and returns to the same page.
 */
export function CorkboardButton({ club, onNavigate, mode = "save", className = "w-full", variant = "outline" }: { club: DirectoryClub; onNavigate: (view: ViewId) => void; mode?: "save" | "follow"; className?: string; variant?: "outline" | "default" }) {
  const { items, authenticated, loading, pending, saveClub, refresh } = useCorkboard()
  const [error, setError] = useState("")
  async function save() {
    setError("")
    try { await saveClub(club, !items.some(item => item.club.id === club.id)) }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save this change.") }
  }
  if (club.source === "preview") return null
  const saved = items.some(item => item.club.id === club.id)
  const label = mode === "follow"
    ? saved ? "Following" : "Follow"
    : authenticated ? saved ? "Remove from saved clubs" : "Save to saved clubs" : "Sign in to save"
  const name = mode === "follow"
    ? `${saved ? "Following" : "Follow"} ${club.name}${authenticated ? "" : " (sign in to save it to your account)"}`
    : `${label}: ${club.name}`
  return <div className="space-y-2">
    <Button type="button" variant={variant} className={className} aria-label={name} aria-pressed={authenticated ? saved : undefined} disabled={authenticated && (loading || pending.has(club.id))} onClick={() => authenticated ? void save() : onNavigate("auth")}>
      {saved ? <BookmarkCheck weight="fill" className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}{label}
    </Button>
    {error && <p role="status" className="text-sm text-destructive">{error}<Button type="button" variant="link" size="sm" className="ml-2 h-auto min-h-11 px-0" onClick={() => void refresh()}>Retry</Button></p>}
  </div>
}
