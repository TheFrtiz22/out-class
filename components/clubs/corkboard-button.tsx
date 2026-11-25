"use client"
import { userMessage } from "@/lib/user-message"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Bookmark, BookmarkCheck } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { JoinPromptDialog } from "@/components/clubs/join-prompt-dialog"
import { useCorkboard } from "@/contexts/corkboard-context"
import { useAuth } from "@/contexts/auth-context"
import { isAlumniProfile } from "@/lib/graduation"
import { followReturnPath, readFollowIntent, withoutFollowIntent } from "@/lib/follow-intent"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"

/** One save intent per page load, even if the club's button renders twice. */
const finishedIntents = new Set<string>()

/**
 * Saves a club to the signed-in account (Saved clubs). `mode="follow"` is the same account
 * record presented as a compact Save / Saved toggle on public club pages; there are no email updates behind it.
 * Signed out, either mode asks the visitor to create an account or sign in, then returns to the
 * same page with `?follow=<clubId>`, where this button finishes the save (lib/follow-intent.ts).
 */
export function CorkboardButton({ club, mode = "save", className = "w-full", variant = "outline" }: { club: DirectoryClub; onNavigate: (view: ViewId) => void; mode?: "save" | "follow"; className?: string; variant?: "outline" | "default" }) {
  const { items, authenticated, loading, pending, saveClub, refresh } = useCorkboard()
  const { user } = useAuth()
  const [error, setError] = useState("")
  const [prompt, setPrompt] = useState<string | null>(null)
  const saved = items.some(item => item.club.id === club.id)
  const alumni = isAlumniProfile(user?.profile)
  const latest = useRef({ saved, alumni, saveClub })
  latest.current = { saved, alumni, saveClub }
  async function save() {
    setError("")
    try { await saveClub(club, !items.some(item => item.club.id === club.id)) }
    catch (e) { setError(userMessage(e, "Couldn’t save this change.")) }
  }
  // Back from sign-up or sign-in with ?follow=<this club>: finish the save the visitor started.
  useEffect(() => {
    if (!authenticated || loading || club.source === "preview" || finishedIntents.has(club.id)) return
    const { pathname, search, hash } = window.location
    if (readFollowIntent(search) !== club.id) return
    finishedIntents.add(club.id)
    window.history.replaceState(window.history.state, "", withoutFollowIntent(pathname, search, hash))
    const { saved: already, alumni: blocked, saveClub: persist } = latest.current
    if (already) { toast.success(`Saved ${club.name}`, { description: "It’s in your saved clubs." }); return }
    if (blocked) return
    persist(club, true)
      .then(() => toast.success(`Saved ${club.name}`, { description: "It’s in your saved clubs." }))
      .catch(e => setError(userMessage(e, "Couldn’t save this club.")))
  }, [authenticated, loading, club])
  if (club.source === "preview") return null
  // Alumni accounts are read-only (lib/graduation.ts): saved clubs are neither added nor removed.
  if (authenticated && isAlumniProfile(user?.profile)) return null
  const label = mode === "follow"
    ? saved ? "Saved" : "Save"
    : authenticated && saved ? "Remove from saved clubs" : "Save club"
  const name = mode === "follow"
    ? `${saved ? "Saved" : "Save"} ${club.name}`
    : `${label}: ${club.name}`
  function askToJoin() {
    const { pathname, search } = window.location
    setPrompt(followReturnPath(pathname, search, club.id))
  }
  return <div className="space-y-2">
    <Button type="button" variant={variant} className={className} aria-label={name} aria-pressed={authenticated ? saved : undefined} disabled={authenticated && (loading || pending.has(club.id))} onClick={() => authenticated ? void save() : askToJoin()}>
      {saved ? <BookmarkCheck weight="fill" className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}{label}
    </Button>
    {error && <p role="status" className="text-sm text-destructive">{error}<Button type="button" variant="link" size="sm" className="ml-2 h-auto min-h-11 px-0" onClick={() => void refresh()}>Retry</Button></p>}
    {prompt && <JoinPromptDialog open onOpenChange={open => { if (!open) setPrompt(null) }}
      title={`Save ${club.name}`}
      description="Create a free OutClass account to save this club and keep its events, deadlines and application in one place. You’ll come right back here."
      returnPath={prompt} />}
  </div>
}
