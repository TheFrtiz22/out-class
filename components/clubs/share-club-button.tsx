"use client"
import { useEffect, useState } from "react"
import { Share } from "@/components/icons"
import { Button } from "@/components/ui/button"
import type { DirectoryClub } from "@/lib/club-directory"

/**
 * Shares the club's public profile link. Phones open the system share sheet (Messages, Mail,
 * Instagram…); desktops copy the link. Either way the link unfurls as the club's profile card
 * (app/(workspace)/club/[clubId]/opengraph-image.tsx).
 */
export function ShareClubButton({ club, className }: { club: Pick<DirectoryClub, "id" | "name" | "source">; className?: string }) {
  const [status, setStatus] = useState("")
  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(""), 2500)
    return () => window.clearTimeout(timer)
  }, [status])
  if (club.source === "preview") return null
  async function share() {
    const url = new URL(`/club/${encodeURIComponent(club.id)}`, window.location.origin).toString()
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${club.name} on OutClass`, url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus("Link copied")
    } catch {
      setStatus("Couldn’t copy the link. Copy it from the address bar.")
    }
  }
  return <>
    <Button type="button" variant="outline" className={className} aria-label={`Share ${club.name}`} onClick={() => void share()}>
      <Share className="size-4" aria-hidden="true" />{status === "Link copied" ? "Link copied" : "Share"}
    </Button>
    <span role="status" className={status && status !== "Link copied" ? "text-sm text-destructive" : "sr-only"}>{status}</span>
  </>
}
