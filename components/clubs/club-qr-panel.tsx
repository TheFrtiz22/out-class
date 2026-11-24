"use client"
import { QrCodeCard } from "@/components/qr/qr-code-card"
import { clubSharePath } from "@/lib/share-links"
import { clubQrFilename } from "@/lib/club-qr"

/**
 * The club's own QR code for posters, tables and the club fair, shown to leaders beside the
 * public profile they edit. It opens the public club page through a permanent /q short link
 * (lib/short-link-store.ts) on the club id, so a printed code keeps working after a rename.
 */
export function ClubQrPanel({ club }: { club: { id: string; name: string } }) {
  return <section aria-label="Club QR code" className="oc-club-qr-panel">
    <QrCodeCard
      title="Your club’s QR code"
      description="Print it for posters and tables, or show it full screen at the club fair. Scanning opens your public page, where students can save your club or apply."
      path={clubSharePath(club.id)}
      filename={clubQrFilename(club.name)}
    />
  </section>
}
