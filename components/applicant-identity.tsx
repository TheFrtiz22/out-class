"use client"
import { useState, type ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserRound } from "@/components/icons"
import { cn } from "@/lib/utils"
import "./applicant-identity.css"

/** Initials from a display name; anonymous labels never produce initials. */
export function applicantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts).map(part => Array.from(part)[0] ?? "")
  return letters.join("").toLocaleUpperCase()
}

/**
 * One applicant identity for review rows and voting slides. The photo URL must
 * already be server-authorized (profilePhotoSource scoped to the viewer's access);
 * anonymous or withheld applicants receive no photo from the server. A missing or
 * failed photo falls back to initials (or a neutral icon when anonymous) in the
 * same fixed square, so nothing shifts and no broken image is shown.
 */
export function ApplicantIdentity({ name, photo, anonymous = false, size = "sm", heading, announcePhoto = false, className, children }: {
  name: string
  photo?: string | null
  anonymous?: boolean
  size?: "sm" | "lg"
  /** Optional element that renders the name (for example a slide heading). */
  heading?: ReactNode
  /** Expose the photo as an image (projected slides); otherwise it is decorative beside the name. */
  announcePhoto?: boolean
  className?: string
  children?: ReactNode
}) {
  const initials = anonymous ? "" : applicantInitials(name)
  const shown = !anonymous && !!photo
  const [loaded, setLoaded] = useState<{ src: string; ok: boolean } | null>(null)
  const visible = shown && loaded?.src === photo && loaded.ok
  const label = announcePhoto ? { role: "img" as const, "aria-label": visible ? "Applicant headshot" : "No applicant photo" } : { "aria-hidden": true as const }
  // Rows render this inside <button> (phrasing content only); a heading needs a block container.
  const Box = heading ? "div" : "span"
  return <Box className={cn("oc-applicant-identity", className)} data-size={size}>
    <Avatar className="oc-applicant-identity-photo" {...label} data-anonymous={anonymous || undefined} data-photo={visible ? "loaded" : "placeholder"}>
      {shown && <AvatarImage src={photo!} alt="" decoding="async" loading="lazy" draggable={false} onLoadingStatusChange={status => { if (status === "loaded" || status === "error") setLoaded({ src: photo!, ok: status === "loaded" }); }} />}
      <AvatarFallback className="oc-applicant-identity-fallback" delayMs={photo ? 400 : 0}>{initials || <UserRound aria-hidden="true" />}</AvatarFallback>
    </Avatar>
    <Box className="oc-applicant-identity-text">{heading ?? <span className="oc-applicant-identity-name">{name}</span>}{children}</Box>
  </Box>
}
