import sharp from "sharp"
import { ActionError } from "@/lib/action-result"
import { prepareClubImage } from "@/lib/club-image"
import { decodeHtml, extractClubPage } from "@/lib/club-website-import/extract"
import { SafeFetchError, safeFetch, type SafeFetchOptions } from "@/lib/club-website-import/safe-fetch"
import type { ImportedClubProfile, ImportedImage } from "@/lib/club-website-import/types"

const PAGE_BYTES = 2 * 1024 * 1024
const IMAGE_BYTES = 5 * 1024 * 1024

/** Reads one image candidate into a re-encoded WebP, or null when it is unusable. */
async function importImage(url: string, kind: "logo" | "banner", request?: SafeFetchOptions["request"]): Promise<ImportedImage | null> {
  try {
    const answer = await safeFetch(url, { accept: ["image/png", "image/jpeg", "image/jpg", "image/webp"], acceptHeader: "image/webp,image/png,image/jpeg;q=0.9", maxBytes: IMAGE_BYTES, timeoutMs: 6000, request })
    // prepareClubImage checks the file signature, decodes the pixels and strips metadata.
    const prepared = await prepareClubImage(new Uint8Array(answer.body), "")
    const image = sharp(prepared.bytes)
    const { width = 0, height = 0 } = await image.metadata()
    if (kind === "logo" ? Math.min(width, height) < 96 : width < 600 || width < height) return null
    const longest = kind === "logo" ? 400 : 1400
    const bytes = await image.resize({ width: longest, height: longest, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    return { contentType: "image/webp", base64: bytes.toString("base64"), source: answer.url.toString() }
  } catch {
    return null
  }
}

async function firstImage(candidates: string[], kind: "logo" | "banner", request?: SafeFetchOptions["request"]) {
  for (const candidate of candidates) {
    const image = await importImage(candidate, kind, request)
    if (image) return image
  }
  return null
}

function failure(error: unknown): never {
  if (error instanceof SafeFetchError) {
    if (error.code === "HTTP_STATUS" && (error.status === 401 || error.status === 403 || error.status === 429 || error.status === 503))
      throw new ActionError("That website blocked OutClass from reading it. Fill in the profile by hand, or try the club's other page.", "WEBSITE_BLOCKED")
    if (error.code === "HTTP_STATUS" && error.status === 404) throw new ActionError("That page wasn't found. Check the link.", "WEBSITE_NOT_FOUND")
    throw new ActionError(error.message, `WEBSITE_${error.code}`)
  }
  throw error
}

/**
 * Fetches a club's public page and returns suggested profile values. Nothing is saved: the
 * leader reviews the values in the profile editor and publishes them through the usual save.
 */
export async function importClubWebsite(input: string, { request }: { request?: SafeFetchOptions["request"] } = {}): Promise<ImportedClubProfile> {
  const typed = input.trim()
  const address = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`
  let page
  try {
    page = await safeFetch(address, { accept: ["text/html", "application/xhtml+xml"], acceptHeader: "text/html,application/xhtml+xml;q=0.9", maxBytes: PAGE_BYTES, timeoutMs: 8000, request })
  } catch (error) { failure(error) }
  const extracted = extractClubPage(decodeHtml(new Uint8Array(page.body), page.charset), page.url)
  const [logo, banner] = await Promise.all([firstImage(extracted.logoCandidates, "logo", request), firstImage(extracted.bannerCandidates, "banner", request)])
  const site = new URL(page.url)
  site.search = ""
  const website = site.protocol === "https:" ? site.toString().replace(/\/$/, "") : extracted.website
  const result: ImportedClubProfile = {
    source: website,
    name: extracted.name, tagline: extracted.tagline, description: extracted.description, color: extracted.color,
    website, email: extracted.email, instagram: extracted.instagram, linkedin: extracted.linkedin, links: extracted.links,
    commitment: extracted.commitment, logo, banner,
  }
  const found = [result.name, result.tagline, result.description, result.email, result.instagram, result.linkedin, result.commitment, result.logo, result.banner, result.links.length].filter(Boolean).length
  if (!found) throw new ActionError("OutClass couldn't find club details on that page. It may load its content in the browser. Fill in the profile by hand.", "WEBSITE_EMPTY")
  return result
}
