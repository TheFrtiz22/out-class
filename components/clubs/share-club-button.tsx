"use client"
import { ShareSheet } from "@/components/share/share-sheet"
import type { DirectoryClub } from "@/lib/club-directory"
import { clubSharePath } from "@/lib/share-links"

/**
 * Opens the share sheet for a club's public profile (Messages, Instagram, WhatsApp, Email,
 * LinkedIn, X, copy link). The link unfurls as the club's profile card
 * (app/(workspace)/club/[clubId]/opengraph-image.tsx). Preview clubs have no public page.
 */
export function ShareClubButton({ club, className, iconOnly }: { club: Pick<DirectoryClub, "id" | "name" | "source">; className?: string; iconOnly?: boolean }) {
  if (club.source === "preview") return null
  return <ShareSheet
    path={clubSharePath(club.id)}
    title={club.name}
    text={`Check out ${club.name} on OutClass`}
    subtitle="Anyone with the link can see the club’s public profile."
    className={className}
    iconOnly={iconOnly}
  />
}
