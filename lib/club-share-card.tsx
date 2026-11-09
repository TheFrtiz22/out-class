import "server-only"
/* eslint-disable @next/next/no-img-element -- next/og renders <img> into a PNG; next/image does not apply. */
import { ImageResponse } from "next/og"
import sharp from "sharp"
import { loadClubShareProfile, type ClubShareProfile } from "@/lib/club-share-profile"
import { clubAssetReference, clubLogoSource, clubProfileImages } from "@/lib/club-assets"
import { analyzeLogoPixels, logoBackgroundColor } from "@/lib/club-logo-background"
import { privateClubAssetStorage } from "@/utils/club-asset-storage"
import { initials } from "@/lib/club-share-text"
import { SHARE_CARD_COLORS as C } from "@/lib/share-card-palette"
import { CACHE, TRANSIENT, SHARE_CARD_SIZE, caslon, clip, dataUrl, glassChip, glassPanel, loadType, loadWordmark, local, renderSiteShareCard, rgba } from "@/lib/share-card"

type ShareProfile = ClubShareProfile


/**
 * Image bytes for a profile field, under the same rule as /api/club-assets: only an asset the
 * club publicly displays. Remote URLs are never fetched server-side (no SSRF); they fall back to
 * the monogram or brand colour.
 */
async function profileImage(club: ShareProfile, value: string | null, field: "logo" | "banner"): Promise<Buffer | null> {
  try {
    const stored = value?.trim() || ""
    if (clubAssetReference.safeParse(stored).success) {
      if (stored.split("/")[1] !== club.id || !clubProfileImages(club, true).includes(stored)) return null
      const { data, error } = await (await privateClubAssetStorage()).download(stored.slice("club-assets/".length))
      return error || !data ? null : Buffer.from(await data.arrayBuffer())
    }
    const inline = /^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(stored)
    if (inline) return Buffer.from(inline[1], "base64")
    // Checked-in artwork only: /logos/<file>, plus (for logos) legacy artwork inferred from the club key.
    const bundled = /^\/logos\/([a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp))$/.exec(stored || (field === "logo" ? clubLogoSource(null, club.id, club.name) : ""))
    return bundled ? await local("public", "logos", bundled[1]) : null
  } catch {
    return null
  }
}

async function logoTile(club: ShareProfile) {
  const bytes = await profileImage(club, club.logoUrl, "logo")
  if (!bytes) return null
  try {
    const { data } = await sharp(bytes).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const background = logoBackgroundColor(club.marketing, club.color, analyzeLogoPixels(data))
    const png = await sharp(bytes).resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    return { src: dataUrl("image/png", png), background: background === "transparent" ? C.white : background }
  } catch {
    return null
  }
}

/** The club's banner, blurred into the backdrop the frosted panel sits on (next/og has no backdrop-filter). */
async function backdrop(club: ShareProfile) {
  const bytes = await profileImage(club, club.bannerUrl, "banner")
  if (!bytes) return null
  try {
    const jpeg = await sharp(bytes).resize(1200, 630, { fit: "cover" }).blur(30).modulate({ saturation: 1.2 }).jpeg({ quality: 80 }).toBuffer()
    return dataUrl("image/jpeg", jpeg)
  } catch {
    return null
  }
}

const hex = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : C.navy)

/**
 * A 1200×630 profile card for link previews in Messages, email, Slack, LinkedIn and X: a frosted
 * glass panel (logo, name, pitch, category, campus) over the club's blurred banner or a soft wash
 * of its brand colour.
 */
export async function renderClubShareCard(idOrSlug: string) {
  let club: ShareProfile | null
  try {
    club = await loadClubShareProfile(idOrSlug)
  } catch {
    // Couldn't check: show the site card, but never let the CDN pin it to this club's URL.
    return renderSiteShareCard(TRANSIENT)
  }
  if (!club) return renderSiteShareCard()
  const [logo, cover, wordmark, [serif, serifBold]] = await Promise.all([logoTile(club), backdrop(club), loadWordmark(), loadType()])
  const color = hex(club.color)
  const name = clip(club.name, 70)
  const nameSize = name.length > 44 ? 48 : name.length > 26 ? 56 : 66
  const summary = clip(club.summary, name.length > 26 ? 100 : 150)
  const chips = [club.category, club.school?.name].filter((label): label is string => !!label?.trim()).map(label => clip(label, 32))
  // Ambient wash: the club's colour top-left, navy bottom-right, a trace of brand orange.
  const wash = [
    `radial-gradient(circle at 12% 18%, ${rgba(color, 0.7)} 0%, ${rgba(color, 0)} 52%)`,
    `radial-gradient(circle at 92% 92%, ${rgba(C.navy, 0.62)} 0%, ${rgba(C.navy, 0)} 55%)`,
    `radial-gradient(circle at 88% 8%, ${rgba(C.orange, 0.22)} 0%, ${rgba(C.orange, 0)} 38%)`,
    `linear-gradient(160deg, ${C.ivory} 0%, ${C.mist} 100%)`,
  ].join(", ")
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", backgroundImage: wash, fontFamily: "Caslon" }}>
      {cover && <img src={cover} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} />}
      <div style={{ position: "absolute", top: 60, left: 60, right: 60, bottom: 60, display: "flex", flexDirection: "column", padding: "40px 56px 40px", borderRadius: 44, ...glassPanel }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          <div style={{ display: "flex", flexShrink: 0, width: 176, height: 176, borderRadius: 40, overflow: "hidden", alignItems: "center", justifyContent: "center", background: logo ? logo.background : color, border: "1.5px solid rgba(255, 255, 255, 0.7)", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 10px 24px -8px rgba(12, 29, 47, 0.3)" }}>
            {logo
              ? <img src={logo.src} alt="" width={148} height={148} style={{ width: 148, height: 148 }} />
              : <div style={{ display: "flex", color: C.white, fontWeight: 600, fontSize: 68, letterSpacing: -2 }}>{initials(club.name)}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 44, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontWeight: 600, fontSize: nameSize, lineHeight: 1.08, color: C.navy, letterSpacing: -1 }}>{name}</div>
            {summary && <div style={{ display: "flex", marginTop: 14, fontSize: 27, lineHeight: 1.32, color: C.body }}>{summary}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {chips.map(label => <div key={label} style={{ display: "flex", marginRight: 12, padding: "9px 22px", borderRadius: 999, color: C.navy, fontSize: 22, ...glassChip }}>{label}</div>)}
          </div>
          <img src={dataUrl("image/svg+xml", wordmark)} alt="OutClass" width={168} height={38} style={{ width: 168, height: 38 }} />
        </div>
      </div>
    </div>,
    {
      ...SHARE_CARD_SIZE,
      headers: { "Cache-Control": CACHE },
      fonts: caslon(serif, serifBold),
    },
  )
}

