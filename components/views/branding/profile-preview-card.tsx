"use client"

import { Globe, Instagram, Linkedin, Mail, Trophy, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ClubBrandingProfile } from "@/lib/data"

function getContrastText(hex: string) {
  const clean = hex.replace("#", "")
  if (!/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(clean)) return "#ffffff"
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff"
}

export function ProfilePreviewCard({ profile }: { profile: ClubBrandingProfile }) {
  const accent = /^#([0-9A-Fa-f]{3}){1,2}$/.test(profile.accentColor) ? profile.accentColor : "#232D4B"
  const textOnAccent = getContrastText(accent)
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-none">
      {/* Banner */}
      <div className="relative h-28 bg-muted">
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl || "/placeholder.svg"}
            alt=""
            className="size-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div
            className="size-full"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          />
        )}
        {/* Logo overlapping banner */}
        <div className="absolute -bottom-8 left-5 flex size-16 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-card shadow-none">
          {profile.logoUrl ? (
            <img
              src={profile.logoUrl || "/placeholder.svg"}
              alt=""
              className="size-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div
              className="flex size-full items-center justify-center text-sm font-semibold"
              style={{ backgroundColor: accent, color: textOnAccent }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-11">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">{profile.name || "Your Club Name"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{profile.tagline || "Your one-line pitch"}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs font-normal">
            {profile.category}
          </Badge>
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
          <div>
            <p className="text-sm font-semibold">{profile.acceptanceRate || "—"}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Acceptance</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{profile.displayAum && profile.aum ? `$${profile.aum}` : "—"}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AUM</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{profile.memberCount || "—"}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</p>
          </div>
        </div>

        {/* Placements */}
        {profile.placements.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="size-3" /> Notable placements
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile.placements.map((p) => (
                <span key={p} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accolades */}
        {profile.accolades.some((a) => a.text.trim()) && (
          <div className="mt-4 space-y-1.5">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Trophy className="size-3" /> Accolades
            </p>
            <ul className="space-y-1">
              {profile.accolades
                .filter((a) => a.text.trim())
                .map((a) => (
                  <li key={a.id} className="text-xs leading-snug">
                    {a.text}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Socials + CTA */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            {profile.website && <Globe className="size-4" aria-label="Website" />}
            {profile.linkedin && <Linkedin className="size-4" aria-label="LinkedIn" />}
            {profile.instagram && <Instagram className="size-4" aria-label="Instagram" />}
            {profile.contactEmail && <Mail className="size-4" aria-label="Contact email" />}
          </div>
          <button
            type="button"
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold"
            style={{ backgroundColor: accent, color: textOnAccent }}
          >
            Apply Now
          </button>
        </div>
      </div>
    </div>
  )
}
