"use client"
import { ShareSheet } from "@/components/share/share-sheet"
import type { DirectoryClub } from "@/lib/club-directory"
import { clubSharePath } from "@/lib/share-links"

/**
 * Opens the share sheet for a club's public profile (Messages, Instagram, WhatsApp, Email,
 * LinkedIn, X, copy link, QR code). The link unfurls as the club's profile card
 * (app/(workspace)/club/[clubId]/opengraph-image.tsx). The QR code is the one to print or show
 * at a club fair: it opens the public page, where a student can follow the club or apply.
 * Preview clubs have no public page.
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
    qr={{ filename: qrFilename(club.name), description: "Scan to see the club, follow it and apply on OutClass." }}
  />
}

/** "TAMID at UVA" → "tamid-at-uva-qr-code". */
function qrFilename(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
  return `${slug || "club"}-qr-code`
}
