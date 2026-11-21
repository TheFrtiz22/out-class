import { z } from "zod"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"
import { publicUrl, type ClubProfileDraft } from "@/lib/club-marketing"
import type { ImportedClubProfile } from "@/lib/club-website-import/types"
import { userMessage } from "@/lib/user-message"

export type ImportMergeResult = { profile: ClubProfileDraft; filled: string[]; kept: string[] }

const email = z.string().email().max(254)
// The navy defaults a club gets before choosing a color (profileDraft still falls back to the older one).
const unsetColors = new Set([DEFAULT_CLUB_COLOR.toLowerCase(), "#232d4b"])
const httpsUrl = (value: string) => !!value && /^https:\/\//i.test(value) && publicUrl.safeParse(value).success

/**
 * Applies imported values to the editor draft. By default only empty fields are filled, so a
 * club's existing words are never overwritten; with `replace` the imported values win. Images
 * are applied separately, after they are uploaded through the club's image controls.
 */
export function mergeImportedProfile(draft: ClubProfileDraft, imported: ImportedClubProfile, { replace = false }: { replace?: boolean } = {}): ImportMergeResult {
  const profile: ClubProfileDraft = { ...draft, marketing: { ...draft.marketing } }
  const filled: string[] = [], kept: string[] = []
  const apply = (label: string, current: string | null | undefined, next: string | null | undefined, write: (value: string) => void, empty = !current?.trim()) => {
    if (!next) return
    if (current === next) return
    if (empty || replace) { write(next); filled.push(label) } else kept.push(label)
  }
  apply("club name", profile.name, imported.name.slice(0, 150), v => { profile.name = v })
  apply("tagline", profile.tagline, imported.tagline.slice(0, 300), v => { profile.tagline = v })
  apply("description", profile.description, imported.description.slice(0, 10000), v => { profile.description = v })
  if (imported.color && /^#[0-9a-f]{6}$/i.test(imported.color)) apply("accent color", profile.color, imported.color, v => { profile.color = v }, !profile.color || unsetColors.has(profile.color.toLowerCase()))
  const m = profile.marketing
  if (httpsUrl(imported.website)) apply("website link", m.website, imported.website, v => { m.website = v })
  if (email.safeParse(imported.email).success) apply("email", m.email, imported.email, v => { m.email = v })
  if (httpsUrl(imported.instagram)) apply("Instagram", m.instagram, imported.instagram, v => { m.instagram = v })
  if (httpsUrl(imported.linkedin)) apply("LinkedIn", m.linkedin, imported.linkedin, v => { m.linkedin = v })
  apply("meeting details", m.commitment, imported.commitment.slice(0, 150), v => { m.commitment = v })
  const known = new Set(m.links.map(link => link.url.toLowerCase().replace(/\/$/, "")))
  const added = imported.links
    .filter(link => httpsUrl(link.url) && link.label.trim() && !known.has(link.url.toLowerCase().replace(/\/$/, "")))
    .slice(0, Math.max(0, 12 - m.links.length))
    .map(link => ({ label: link.label.trim().slice(0, 60), url: link.url }))
  if (added.length) { m.links = [...m.links, ...added]; filled.push(added.length === 1 ? `${added[0].label} link` : `${added.length} social links`) }
  return { profile, filled, kept }
}

/** Decodes an imported image into a File for the club's normal upload path. */
export function importedImageFile(image: { base64: string; contentType: string }, name: string): File {
  const binary = atob(image.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], `${name}.webp`, { type: image.contentType })
}

const listed = (items: string[]) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

/**
 * Uploads the imported logo and cover image into `profile` through the editor's own upload path.
 * A club that has not been saved yet has nowhere to store images (`uploadsAfterSave`), so the
 * leader is told to add them after saving rather than shown an upload failure.
 */
export async function applyImportedImages(
  profile: ClubProfileDraft,
  imported: Pick<ImportedClubProfile, "logo" | "banner">,
  { replace = false, upload, uploadsAfterSave = false }: { replace?: boolean; upload?: (file: File) => Promise<string>; uploadsAfterSave?: boolean } = {},
): Promise<{ filled: string[]; kept: string[]; notes: string[] }> {
  const filled: string[] = [], kept: string[] = [], notes: string[] = [], waiting: string[] = []
  for (const [key, label, image] of [["logoUrl", "logo", imported.logo], ["bannerUrl", "cover image", imported.banner]] as const) {
    if (!image) continue
    if (profile[key] && !replace) { kept.push(label); continue }
    if (uploadsAfterSave || !upload) { waiting.push(label); continue }
    try { profile[key] = await upload(importedImageFile(image, key === "logoUrl" ? "club-logo" : "club-cover")); filled.push(label) }
    catch (uploadError) { notes.push(`The ${label} wasn't added: ${userMessage(uploadError, "the upload failed.")}`) }
  }
  if (waiting.length) notes.unshift(uploadsAfterSave
    ? `Save the club first, then add the ${listed(waiting)} with the image controls.`
    : `The ${listed(waiting)} can be added with the image controls.`)
  return { filled, kept, notes }
}
