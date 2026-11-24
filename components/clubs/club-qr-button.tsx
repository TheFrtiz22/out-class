"use client"
import { useState, type ComponentProps } from "react"
import { createShortLink } from "@/actions/short-links"
import { QrCode } from "@/components/icons"
import { QrPresenterDialog } from "@/components/qr/qr-presenter-dialog"
import { Button } from "@/components/ui/button"
import { useDemoMode } from "@/contexts/demo-context"
import { clubQrFilename } from "@/lib/club-qr"
import { clubSharePath } from "@/lib/share-links"
import { cn } from "@/lib/utils"

/**
 * One click to the club's own QR code from the club workspace (Home and Recruiting headers): the same code as
 * Settings › Public profile, shown in the presenter with full screen, PNG/SVG download and copy link. It opens
 * the public club page through the club's permanent /q short link, which is only asked for on click, so
 * viewing the workspace writes nothing. The demo club has no public page, so the button is left out there.
 */
export function ClubQrButton({ club, variant = "outline", size = "lg", className }: { club: { id: string; name: string } } & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  const demo = useDemoMode()
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  if (demo.isDemoEnabled) return null
  const path = clubSharePath(club.id)

  async function present() {
    if (loading) return
    setLoading(true)
    // The short link keeps the code sparse enough to scan across a room; the page's own address scans too.
    const short = await Promise.race([
      createShortLink({ target: path }).then(result => result.shortUrl.startsWith("/") ? `${window.location.origin}${result.shortUrl}` : "").catch(() => ""),
      new Promise<string>(resolve => window.setTimeout(() => resolve(""), 4000)),
    ])
    setValue(short || `${window.location.origin}${path}`)
    setLoading(false)
    setOpen(true)
  }

  return <>
    <Button type="button" variant={variant} size={size} className={cn("oc-club-qr-button", className)} aria-label="Club QR code" aria-busy={loading || undefined} disabled={loading} onClick={() => void present()}>
      <QrCode aria-hidden="true" /><span className="oc-club-qr-label">{loading ? "Loading…" : "Club QR code"}</span>
    </Button>
    {value && <QrPresenterDialog
      trigger={false}
      open={open}
      onOpenChange={setOpen}
      value={value}
      title={club.name}
      description="Scan to see the club, follow it and apply on OutClass."
      filename={clubQrFilename(club.name)}
      ariaLabel={`QR code for ${club.name}`}
    />}
  </>
}
