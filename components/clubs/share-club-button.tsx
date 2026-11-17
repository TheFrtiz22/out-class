"use client"
import { ShareSheet } from "@/components/share/share-sheet"
import type { DirectoryClub } from "@/lib/club-directory"
import { clubSharePath } from "@/lib/share-links"
import { useAuth } from "@/contexts/auth-context"
import { createShortLink } from "@/actions/short-links"
import { clubQrFilename } from "@/lib/club-qr"

/**
 * Opens the share sheet for a club's public profile (Messages, Instagram, WhatsApp, Email,
 * LinkedIn, X, copy link, QR code). The link unfurls as the club's profile card
 * (app/(workspace)/club/[clubId]/opengraph-image.tsx). The QR code is the one to print or show
 * at a club fair: it opens the public page, where a student can follow the club or apply.
 * Preview clubs have no public page.
 */
export function ShareClubButton({ club, className, iconOnly }: { club: Pick<DirectoryClub, "id" | "name" | "source">; className?: string; iconOnly?: boolean }) {
  const { user } = useAuth()
  if (club.source === "preview") return null
  const path = clubSharePath(club.id)
  // createShortLink needs a session: for a signed-out caller it redirects the whole page away
  // from the club instead of failing, so visitors get a code for the page's own address.
  const shortLink = user ? () => createShortLink({ target: path }).then(result => result.shortUrl) : undefined
  return <ShareSheet
    path={path}
    title={club.name}
    text={`Check out ${club.name} on OutClass`}
    subtitle="Anyone with the link can see the club’s public profile."
    className={className}
    iconOnly={iconOnly}
    qr={{ filename: clubQrFilename(club.name), description: "Scan to see the club, follow it and apply on OutClass.", shortLink }}
  />
}

