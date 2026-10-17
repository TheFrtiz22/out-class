import { z } from "zod"
import { clubProfileSchema } from "@/lib/club-marketing"

const file = z.string().regex(/^images\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/)
const row = z.object({
  key: z.string().min(1).max(100), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  existingId: z.string().uuid().nullable().default(null),
  profile: clubProfileSchema,
  imageAssignments: z.object({ logoUrl: z.array(file).max(1).optional(), bannerUrl: z.array(file).max(1).optional(), "marketing.gallery": z.array(file).max(6).optional() }).strict().default({}),
})
export const clubProfileImportSchema = z.object({ profiles: z.array(row).min(1).max(30) }).superRefine((data, ctx) => {
  const slugs = new Set<string>()
  data.profiles.forEach((item, i) => {
    if (slugs.has(item.slug)) ctx.addIssue({ code: 'custom', path: ['profiles', i, 'slug'], message: 'Duplicate club slug.' })
    slugs.add(item.slug)
    if (item.profile.logoUrl || item.profile.bannerUrl || item.profile.marketing.gallery.some(g => g.url) || item.profile.marketing.sections.some(s => s.cards.some(c => c.image))) ctx.addIssue({ code: 'custom', path: ['profiles', i, 'profile'], message: 'Provide local image assignments, not preassigned image URLs.' })
  })
})
export type ClubProfileImport = z.infer<typeof clubProfileImportSchema>
export function importImageNames(row: ClubProfileImport['profiles'][number]) {
  return [...new Set(Object.values(row.imageAssignments).flatMap(files => files ?? []))].map(path => path.slice('images/'.length))
}

type ImportPlan = { row: ClubProfileImport['profiles'][number]; current: { id: string; version: string } | null }[]
type ImportOperations = {
  save: (input: unknown) => Promise<{ id?: string; error?: string }>
  load: (id: string) => Promise<{ id: string; version: string } | null>
  upload: (clubId: string, file: File) => Promise<string>
  progress: (name: string) => void
}
/** Client orchestration only. Every operation must use the canonical authorized server action. */
export async function runClubProfileImport(plan: ImportPlan, images: File[], schoolId: string, reason: string, operations: ImportOperations) {
  clubProfileImportSchema.parse({ profiles: plan.map(p => p.row) })
  if (!schoolId || reason.trim().length < 10 || reason.length > 1000) throw Error('Provide a school and a reason of 10–1000 characters.')
  const byName = new Map(images.map(file => [file.name, file]))
  if (byName.size !== images.length) throw Error('Image filenames must be unique.')
  // Reject the whole package before any writes if one requested asset is missing/invalid.
  for (const { row } of plan) for (const name of importImageNames(row)) {
    const image = byName.get(name)
    if (!image) throw Error(`Missing image: ${name}.`)
    if (!image.size || image.size > 5242880 || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) throw Error(`Invalid image: ${name}. Use PNG, JPEG or WebP up to 5 MB.`)
  }
  for (const { row, current } of plan) {
    operations.progress(row.profile.name)
    let saved = current
    if (!saved) {
      const created = await operations.save({ slug: row.slug, schoolId, isDiscoverable: false, applicationOpen: false, applicationDeadline: null, profile: { ...row.profile, marketing: { ...row.profile.marketing, gallery: [] } }, reason })
      if (!created.id) throw Error(created.error || 'Creation failed. Review again before retrying.')
      saved = await operations.load(created.id)
      if (!saved) throw Error('Created club could not be loaded. Review again before retrying.')
    }
    const profile = structuredClone(row.profile), uploaded = new Map<string, string>()
    for (const name of importImageNames(row)) uploaded.set(`images/${name}`, await operations.upload(saved.id, byName.get(name)!))
    profile.logoUrl = uploaded.get(row.imageAssignments.logoUrl?.[0] || '') || null
    profile.bannerUrl = uploaded.get(row.imageAssignments.bannerUrl?.[0] || '') || null
    profile.marketing.gallery = (row.imageAssignments['marketing.gallery'] || []).map((path, index) => ({ url: uploaded.get(path)!, caption: row.profile.marketing.gallery[index]?.caption || `${row.profile.name} · official club photography` }))
    const result = await operations.save({ id: saved.id, version: saved.version, slug: row.slug, schoolId, isDiscoverable: true, applicationOpen: false, applicationDeadline: null, profile, reason })
    if (!result.id) throw Error(result.error || 'Publication failed. Review again before retrying.')
  }
}
