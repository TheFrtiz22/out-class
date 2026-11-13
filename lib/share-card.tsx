import "server-only"
/* eslint-disable @next/next/no-img-element -- next/og renders <img> into a PNG; next/image does not apply. */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import sharp from "sharp"
import { SHARE_CARD_COLORS as C } from "@/lib/share-card-palette"

/** Shared pieces of the OutClass link-preview cards (site and club): size, type, glass material. */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 }
export const SHARE_CARD_TYPE = "image/png"
// Crawlers (iMessage, Slack, LinkedIn, X) fetch once; the CDN absorbs repeats. A profile edit shows within the hour.
export const CACHE = "public, max-age=3600, s-maxage=3600"
// A card rendered while the database was unreachable: browsers may reuse it briefly, the CDN must not.
export const TRANSIENT = "public, max-age=60, s-maxage=0"

export const local = (...parts: string[]) => readFile(join(process.cwd(), ...parts))
export const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`

export function clip(text: string, max: number) {
  const clean = text.trim().replace(/\s+/g, " ")
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/[\s,.;:–—-]+\S*$/, "")}…`
}

export const arrayBuffer = (bytes: Buffer) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
export const caslon = (regular: Buffer, semibold: Buffer) => [
  { name: "Caslon", data: arrayBuffer(regular), weight: 400 as const, style: "normal" as const },
  { name: "Caslon", data: arrayBuffer(semibold), weight: 600 as const, style: "normal" as const },
]
// Literal paths so file tracing bundles them into the image functions (also listed in
// next.config.mjs outputFileTracingIncludes; public/ is otherwise CDN-only on Vercel).
export const loadType = () => Promise.all([
  readFile(join(process.cwd(), "app/fonts/libre-caslon-text/libre-caslon-text-400-static.ttf")),
  readFile(join(process.cwd(), "app/fonts/libre-caslon-text/libre-caslon-text-600-static.ttf")),
])
export const loadWordmark = () => readFile(join(process.cwd(), "public/brand/premium-board/04_wordmark_no_sword.svg"))

// The light glass material from styles/navigation-glass.css (--oc-glass-light-material / -edge / -depth).
export const glassPanel = {
  backgroundColor: "rgba(255, 251, 245, 0.78)",
  backgroundImage: "radial-gradient(ellipse at 12% 0%, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0) 55%), linear-gradient(174deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0) 48%, rgba(152, 176, 201, 0.1))",
  border: "1.5px solid rgba(255, 255, 255, 0.68)",
  boxShadow: "inset 0 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(20, 45, 69, 0.12), 0 4px 8px rgba(12, 29, 47, 0.06), 0 28px 56px -18px rgba(12, 29, 47, 0.34)",
}
// Chips: --oc-glass-tint-sheen over a translucent fill, with the tint highlight.
export const glassChip = {
  backgroundColor: "rgba(255, 255, 255, 0.5)",
  backgroundImage: "linear-gradient(172deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 62%)",
  border: "1.5px solid rgba(20, 45, 69, 0.1)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
}

export function rgba(color: string, alpha: number) {
  const n = parseInt(color.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * The site-wide OutClass card (homepage and every page without its own): the same glass panel
 * over the Rotunda from the homepage opening (CC BY 2.0, credited in lib/photo-credits.ts). Served prerendered from /og/outclass.png.
 */
export async function renderSiteShareCard(cacheControl = CACHE) {
  const [photo, wordmark, [serif, serifBold]] = await Promise.all([
    readFile(join(process.cwd(), "public/images/campus/rotunda-1600.webp")), loadWordmark(), loadType(),
  ])
  // Sharp Rotunda on the left, fading into a blurred wash of the same photograph behind the glass.
  const fade = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="760" height="630"><defs><linearGradient id="f"><stop offset="0.62" stop-color="white" stop-opacity="1"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="760" height="630" fill="url(#f)"/></svg>')
  const [wash, rotunda] = await Promise.all([
    sharp(photo).resize(1200, 630, { fit: "cover" }).blur(28).modulate({ saturation: 1.15 }).jpeg({ quality: 80 }).toBuffer(),
    sharp(photo).resize({ height: 630 }).extract({ left: 60, top: 0, width: 760, height: 630 }).ensureAlpha().composite([{ input: fade, blend: "dest-in" }]).png().toBuffer(),
  ])
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", fontFamily: "Caslon", backgroundColor: C.navy }}>
      <img src={dataUrl("image/jpeg", wash)} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} />
      <img src={dataUrl("image/png", rotunda)} alt="" width={760} height={630} style={{ position: "absolute", top: 0, left: 0, width: 760, height: 630 }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, backgroundImage: `linear-gradient(180deg, ${rgba(C.navy, 0)} 55%, ${rgba(C.navy, 0.35)} 100%)` }} />
      <div style={{ position: "absolute", top: 60, right: 60, bottom: 60, width: 540, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "46px 46px 40px", borderRadius: 44, ...glassPanel }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <img src={dataUrl("image/svg+xml", wordmark)} alt="OutClass" width={248} height={56} style={{ width: 248, height: 56 }} />
          <div style={{ display: "flex", marginTop: 30, fontWeight: 600, fontSize: 44, lineHeight: 1.1, color: C.navy, letterSpacing: -1 }}>Apply to UVA clubs with one profile.</div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 24, lineHeight: 1.35, color: C.body }}>Applications, interviews and decisions, all in one place.</div>
        </div>
        <div style={{ display: "flex" }}>
          {["University of Virginia", "out-class.net"].map(label => <div key={label} style={{ display: "flex", flexShrink: 0, marginRight: 12, padding: "8px 20px", borderRadius: 999, color: C.navy, fontSize: 21, ...glassChip }}>{label}</div>)}
        </div>
      </div>
    </div>,
    { ...SHARE_CARD_SIZE, headers: { "Cache-Control": cacheControl }, fonts: caslon(serif, serifBold) },
  )
}
