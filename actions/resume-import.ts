"use server"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { validateProfileFile } from "@/lib/student-profile"
import { extractPdfText } from "@/lib/resume-pdf"
import { extractResumeProposal, confirmImportSchema, importBaseline } from "@/lib/resume-import"
import { uploadProfileFile } from "@/actions/storage"
import { revalidatePath } from "next/cache"

const failure = (code: string, message: string) => ({ ok: false as const, code, message })

export async function prepareResumeImport(input: FormData) {
  const { user } = await requireAuth()
  try {
    if (input.getAll("file").length !== 1 || Array.from(input.keys()).some(k => k !== "file")) throw Error("Choose only a PDF file; storage paths and owners cannot be supplied.")
    const file = input.get("file")
    if (!file || typeof file === "string" || !file.size) throw Error("Choose a PDF résumé.")
    if (file.size > 10 * 1024 * 1024) throw Error("Choose a PDF up to 10 MB.")
    if (!/\.pdf$/i.test(file.name)) throw Error("Choose a PDF file.")
    const bytes = new Uint8Array(await file.arrayBuffer())
    try { validateProfileFile(bytes, file.type, "resume") } catch { return failure("INVALID_PDF", "Choose a valid PDF résumé. Other file types are unsupported.") }
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, include: { experiences: true } })
    if (!profile) throw Error("Complete your student profile before importing a résumé.")
    const proposal = extractResumeProposal(await extractPdfText(bytes))
    // Storage remains independent of confirmation, exactly as in the attachment editor.
    const upload = new FormData(); upload.set("kind", "resume"); upload.set("file", file)
    const { reference } = await uploadProfileFile(upload)
    return { ok: true as const, proposal, baseline: importBaseline(profile), reference }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (/^(Choose |Provide |Complete your |No meaningful text|The PDF contains|PDF processing|PDF extraction|This PDF is|Password-protected|Private document storage|Support uploads|Upload failed|Could not prepare upload)/.test(message)) return failure("IMPORT_REJECTED", message)
    return failure("EXTRACTION_FAILED", "Could not read this PDF. Export a new text-based résumé PDF and try again.")
  }
}
export async function confirmResumeImport(input: unknown) {
  const { user } = await requireAuth()
  const parsed = confirmImportSchema.safeParse(input)
  if (!parsed.success) return failure("INVALID_PROFILE", "Check the selected profile values before saving.")
  const { patch, experiences, baseline, resumeReference } = parsed.data
  if (resumeReference && !resumeReference.startsWith(`${user.id}/`)) return failure("INVALID_ATTACHMENT", "You can only attach your own résumé.")
  if (!Object.keys(patch).length && !experiences.length && !resumeReference) return failure("NO_CHANGES", "Select at least one change to save.")
  try {
    const profile = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE "userId"=${user.id} FOR UPDATE`
      const current = await tx.studentProfile.findUnique({ where: { userId: user.id }, include: { experiences: true } })
      if (!current) throw Error("PROFILE_MISSING")
      for (const field of [...Object.keys(patch), ...(resumeReference ? ["resumeUrl"] : [])]) {
        if (!(field in baseline) || baseline[field as keyof typeof baseline] !== current[field as keyof typeof current]) throw Error("PROFILE_CHANGED")
      }
      const key = (v: { title: string; subtitle: string; period: string }) => [v.title, v.subtitle, v.period].map(s => s.trim().toLowerCase()).join("\u0000")
      const seen = new Set(current.experiences.map(key))
      const additions = experiences.filter(v => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true })
      if (current.experiences.length + additions.length > 50) throw Error("EXPERIENCE_LIMIT")
      return tx.studentProfile.update({ where: { userId: user.id }, data: { ...patch, ...(resumeReference ? { resumeUrl: resumeReference } : {}), ...(additions.length ? { experiences: { create: additions } } : {}) }, include: { experiences: true } })
    }, { isolationLevel: "Serializable" })
    revalidatePath("/")
    return { ok: true as const, profile }
  } catch (error) {
    const reason = error instanceof Error ? error.message : ""
    if (reason === "PROFILE_CHANGED") return failure("PROFILE_CHANGED", "Your profile changed since extraction. Close this review and import again before replacing values.")
    if (reason === "EXPERIENCE_LIMIT") return failure("EXPERIENCE_LIMIT", "Your profile can contain up to 50 experience entries. Remove some proposed entries.")
    return failure("SAVE_FAILED", "Your changes could not be saved. No imported profile changes were applied; retry or reload your profile.")
  }
}
