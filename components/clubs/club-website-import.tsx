"use client"
import { useId, useState } from "react"
import { Globe } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"
import { importClubFromWebsite } from "@/actions/club-website-import"
import { unwrapAction } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import type { ClubProfileDraft } from "@/lib/club-marketing"
import { importedImageFile, mergeImportedProfile } from "@/lib/club-website-import/merge"

const list = (items: string[]) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
const hostOf = (value: string) => { try { return new URL(value).hostname.replace(/^www\./, "") } catch { return "the website" } }

/**
 * Fills the profile editor from a club's website. The values land in the editor as unsaved
 * edits; nothing is published until the leader reviews them and presses Publish.
 */
export function ClubWebsiteImport({ clubId, draft, onApply, onUpload, onBusyChange, disabled = false }: {
  clubId?: string
  draft: ClubProfileDraft
  onApply: (profile: ClubProfileDraft) => void
  onUpload?: (file: File) => Promise<string>
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const [url, setUrl] = useState(draft.marketing.website || "")
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")

  async function run() {
    if (busy || !url.trim()) return
    setBusy(true); onBusyChange?.(true); setError(""); setStatus("")
    try {
      const imported = unwrapAction(await importClubFromWebsite({ url: url.trim(), ...(clubId ? { clubId } : {}) }))
      const { profile, filled, kept } = mergeImportedProfile(draft, imported, { replace })
      const skipped: string[] = []
      for (const [key, label, image] of [["logoUrl", "logo", imported.logo], ["bannerUrl", "cover image", imported.banner]] as const) {
        if (!image) continue
        if (profile[key] && !replace) { kept.push(label); continue }
        if (!onUpload) { skipped.push(`The ${label} can be added with the image controls.`); continue }
        try { profile[key] = await onUpload(importedImageFile(image, key === "logoUrl" ? "club-logo" : "club-cover")); filled.push(label) }
        catch (uploadError) { skipped.push(`The ${label} wasn't added: ${userMessage(uploadError, "the upload failed.")}`) }
      }
      if (filled.length) onApply(profile)
      const from = hostOf(imported.source)
      setStatus([
        filled.length ? `Filled ${list(filled)} from ${from}. Review them, then publish.` : `Your profile already has what ${from} offers.`,
        kept.length && !replace ? `Kept your ${list(kept)}. Turn on Replace to use the website's version.` : "",
        ...skipped,
      ].filter(Boolean).join(" "))
    } catch (importError) {
      setError(userMessage(importError, "OutClass couldn't read that website. Fill in the profile by hand."))
    } finally { setBusy(false); onBusyChange?.(false) }
  }

  return <section aria-labelledby={`${id}-heading`} className="oc-content-panel space-y-4" data-saving={busy}>
    <div><h3 id={`${id}-heading`} className="inline-flex items-center gap-2 text-sm font-semibold"><Globe size={16} aria-hidden="true" />Fill from the club’s website</h3><p className="mt-1 text-sm text-muted-foreground">Paste the club’s website link. OutClass reads the public page and fills the profile for you to review.</p></div>
    <div className="flex flex-col gap-2 sm:flex-row">
      {/* type="text": this field sits inside the profile form, and a url-typed field would block Publish. */}
      <Input aria-label="Club website link" type="text" inputMode="url" autoComplete="url" spellCheck={false} placeholder="https://yourclub.org" maxLength={2000} value={url} disabled={disabled || busy}
        onChange={e => { setUrl(e.target.value); setError("") }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void run() } }} />
      <Button type="button" disabled={disabled || busy || !url.trim()} onClick={() => void run()}>{busy ? "Reading website…" : "Fill profile"}</Button>
    </div>
    <Toggle label="Replace fields that already have content" checked={replace} disabled={disabled || busy} onCheckedChange={setReplace} />
    <div aria-live="polite">{status && <p className="text-sm">{status}</p>}</div>
    {error && <p role="alert" className="text-control text-destructive">{error}</p>}
  </section>
}
